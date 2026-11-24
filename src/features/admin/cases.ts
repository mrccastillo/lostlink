import "server-only";
import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/auth/policy";
import { getCurrentSession } from "@/lib/auth/session";
import { getAdminDatabase } from "./runtime";
import type { Report } from "@/lib/reports/service";
import { REPORT_UUID } from "@/features/reports/policy";
import type { ClaimInput } from "@/features/claims/policy";
import { adminQueues, type AdminQueue } from "./navigation";

const community = { organization: "community" } as const;
const pageSize = 20;
type Claim = Omit<ClaimInput, "requestId" | "confirmed"> & {
  _id: string; claimantId: string; organization: string; status: string; createdAt: Date; decisionReason?: string;
};
type CaseReport = Report & { moderationReason?: string; approvedMedia?: string[]; reservedClaimId?: string };
type Event = {
  _id: ObjectId; organization: string; actorId: string; action: string; entityId: string;
  reportId?: string; claimId?: string; linkedLostId?: string; from?: string; to?: string; lifecycleFrom?: string; lifecycleTo?: string; createdAt: Date;
};
const claimRow = { _id: 1, reportId: 1, claimantId: 1, status: 1, createdAt: 1 };
export const queueStates = {
  reports: ["pending", "published", "hidden"],
  claims: ["pending", "approved", "rejected", "withdrawn", "fulfilled", "cancelled"],
  pickups: ["approved"],
} as const;
export function queueDefinition(value: string) {
  return adminQueues.find(queue => queue.key === value) ?? notFound();
}

async function staffDatabase(path: string) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=" + encodeURIComponent(path));
  if (!session.user.emailVerified) redirect("/verify-email?next=" + encodeURIComponent(path));
  if (!canAccessAdmin(session.user)) notFound();
  return getAdminDatabase();
}
function readCursor(cursor?: string, audit = false) {
  if (cursor === undefined) return null;
  const [stamp, id, extra] = cursor.split("_");
  const date = new Date(stamp);
  if (extra !== undefined || !id || !(audit ? /^[a-f\d]{24}$/i : REPORT_UUID).test(id)
    || !Number.isFinite(date.getTime()) || date.toISOString() !== stamp) notFound();
  return { date, id };
}
function queueWindow(cursor?: string) {
  const after = readCursor(cursor);
  return after ? { $or: [{ createdAt: { $lt: after.date } }, { createdAt: after.date, _id: { $lt: after.id } }] } : {};
}
function page<T extends { createdAt: Date; _id: string | ObjectId }>(rows: T[]) {
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  return { items, next: last && rows.length > pageSize ? last.createdAt.toISOString() + "_" + last._id : null };
}
export async function readQueue(queue: AdminQueue, state: string, cursor?: string) {
  const db = await staffDatabase("/admin/" + queue);
  if (!queueStates[queue].some(value => value === state)) notFound();
  const filter = { ...community, ...queueWindow(cursor) };
  const reports = db.collection<CaseReport>("reports");
  const sort = { createdAt: -1, _id: -1 } as const;
  if (queue === "reports") {
    const result = page(await reports.find({ ...filter, moderation: state as Report["moderation"] },
      { projection: { title: 1, type: 1, createdAt: 1 }, sort, limit: pageSize + 1 }).toArray());
    return { next: result.next, items: result.items.map(r => ({ id: r._id, title: r.title, detail: r.type, date: r.createdAt })) };
  }
  type ClaimQueueRow = Pick<Claim, "_id" | "createdAt" | "claimantId"> & { title: string };
  const rows = await db.collection<Claim>("claims").aggregate<ClaimQueueRow>([
    { $match: { ...filter, status: state } },
    { $sort: sort },
    { $limit: pageSize + 1 },
    { $lookup: {
      from: "reports", localField: "reportId", foreignField: "_id", as: "report",
      pipeline: [{ $match: { ...community, type: "found" } }, { $project: { _id: 0, title: 1 } }],
    } },
    { $project: { claimantId: 1, createdAt: 1, title: { $ifNull: [{ $first: "$report.title" }, "Report unavailable"] } } },
  ]).toArray();
  const result = page(rows);
  return { next: result.next, items: result.items.map(c => ({ id: c._id, title: c.title, detail: "Claimant " + c.claimantId, date: c.createdAt })) };
}
export async function readCase(queue: AdminQueue, id: string, historyCursor?: string, claimsCursor?: string) {
  if (!REPORT_UUID.test(id)) notFound();
  const db = await staffDatabase("/admin/" + queue + "/" + id);
  const claims = db.collection<Claim>("claims");
  const claim = queue === "reports" ? null : await claims.findOne({ ...community, _id: id }, {
    projection: { ...claimRow, identifyingDetail: 1, circumstances: 1, additionalContext: 1, attachments: 1, decisionReason: 1 },
  });
  if (queue !== "reports" && !claim) notFound();
  const report = await db.collection<CaseReport>("reports").findOne({ ...community, _id: claim?.reportId ?? id, ...(claim ? { type: "found" as const } : {}) }, {
    projection: { title: 1, type: 1, category: 1, location: 1, occurredOn: 1, description: 1, attachments: 1, approvedMedia: 1, moderation: 1, lifecycle: 1, moderationReason: 1, reservedClaimId: 1 },
  });
  if (!report) notFound();
  const after = readCursor(historyCursor, true);
  const affected = claim ? [{ entityId: id }, { claimId: id }] : [{ entityId: id }, { reportId: id }, { linkedLostId: id }];
  const history = db.collection<Event>("audit_events").find({ ...community, $and: [
    { $or: affected },
    ...(after ? [{ $or: [{ createdAt: { $gt: after.date } }, { createdAt: after.date, _id: { $gt: new ObjectId(after.id) } }] }] : []),
  ] }, { projection: { createdAt: 1, action: 1, entityId: 1, actorId: 1, reportId: 1, claimId: 1, linkedLostId: 1, from: 1, to: 1, lifecycleFrom: 1, lifecycleTo: 1 },
    sort: { createdAt: 1, _id: 1 }, limit: pageSize + 1 });
  const related = claims.find({ ...community, reportId: report._id, ...(claim ? { _id: { $ne: id } } : {}), ...queueWindow(claimsCursor) },
    { projection: claimRow, sort: { createdAt: -1, _id: -1 }, limit: pageSize + 1 });
  const [events, others] = await Promise.all([history.toArray(), related.toArray()]);
  return { report, claim, history: page(events), related: page(others) };
}

