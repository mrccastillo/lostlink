import type { Db, ObjectId } from "mongodb";
import { REPORT_UUID } from "@/features/reports/policy";
import { canAccessAdmin, type AccountAccess } from "@/lib/auth/policy";
import { reportCovers } from "@/lib/media/report-covers";
import type { Report } from "@/lib/reports/service";

type PendingReport = Pick<Report, "_id" | "title" | "type" | "createdAt" | "description" | "attachments">;
const community = { organization: "community" } as const;

const staffActivity = {
  "report.published": { label: "Report published", path: "/admin/reports" },
  "report.hidden": { label: "Report hidden", path: "/admin/reports" },
  "claim.approved": { label: "Claim approved", path: "/admin/claims" },
  "claim.rejected": { label: "Claim rejected", path: "/admin/claims" },
  "claim.cancelled": { label: "Reservation cancelled", path: "/admin/claims" },
  "claim.fulfilled": { label: "Return recorded", path: "/admin/claims" },
} as const;

type StaffEvent = {
  _id: ObjectId;
  action: keyof typeof staffActivity;
  entityId: unknown;
  createdAt: Date;
};

async function readRecentActivity(db: Db) {
  const events = await db.collection("audit_events")
    .find({ ...community, action: { $in: Object.keys(staffActivity) } })
    .project<StaffEvent>({ _id: 1, action: 1, entityId: 1, createdAt: 1 })
    .sort({ createdAt: -1, _id: -1 })
    .limit(5)
    .toArray();

  return events.map(({ _id, action, entityId, createdAt }) => {
    const { label, path } = staffActivity[action];
    const href = typeof entityId === "string" && REPORT_UUID.test(entityId)
      ? `${path}/${entityId}` : path;
    return { id: _id.toHexString(), label, href, createdAt };
  });
}

export async function readAdminOverview(
  user: AccountAccess,
  getDatabase: () => Promise<Db>,
) {
  if (!canAccessAdmin(user)) return null;

  const db = await getDatabase();
  const reports = db.collection<Report>("reports");
  const pending = { ...community, moderation: "pending" } as const;
  const claims = db.collection("claims");
  const [pendingReports, pendingClaims, reservedPickups, completedReturns, recentActivity, rows] = await Promise.all([
    reports.countDocuments(pending),
    claims.countDocuments({ ...community, status: "pending" }),
    claims.countDocuments({ ...community, status: "approved" }),
    db.collection("return_events").countDocuments(community),
    readRecentActivity(db),
    reports.find(pending)
      .project<PendingReport>({ _id: 1, title: 1, type: 1, createdAt: 1, description: 1, attachments: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .toArray(),
  ]);

  const covers = await reportCovers(db, rows, "report");
  const recentReports = rows.map(({ _id, title, type, createdAt, description }) => ({ _id, title, type, createdAt, description, cover: covers.get(_id) ?? null }));
  return { pendingReports, pendingClaims, recentReports, reservedPickups, completedReturns, recentActivity };
}

export async function ensureAdminOverviewIndexesV1(db: Db) {
  await Promise.all([
    db.collection("reports").createIndex(
      { organization: 1, moderation: 1, createdAt: -1, _id: -1 },
      { name: "reports_admin_queue_v1" },
    ),
    db.collection("claims").createIndex(
      { organization: 1, status: 1 },
      { name: "claims_admin_pending_v1" },
    ),
  ]);
}

export async function ensureAdminCaseIndexesV2(db: Db) {
  await ensureAdminOverviewIndexesV1(db);
  await Promise.all([
    db.collection("claims").createIndex(
      { organization: 1, status: 1, createdAt: -1, _id: -1 }, { name: "claims_admin_queue_v2" },
    ),
    db.collection("claims").createIndex(
      { organization: 1, reportId: 1, createdAt: -1, _id: -1 }, { name: "claims_admin_competing_v2" },
    ),
    ...["entityId", "reportId", "claimId", "linkedLostId"].map(field =>
      db.collection("audit_events").createIndex(
        { organization: 1, [field]: 1, createdAt: 1, _id: 1 },
        { name: `admin_history_${field}_v2`, partialFilterExpression: { [field]: { $exists: true } } },
      ),
    ),
  ]);
}

export async function ensureAdminOverviewIndexesV3(db: Db) {
  await ensureAdminCaseIndexesV2(db);
  await db.collection("audit_events").createIndex(
    { organization: 1, action: 1, createdAt: -1, _id: -1 },
    { name: "admin_recent_activity_v3" },
  );
}
