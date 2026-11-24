import { createHash } from "node:crypto";
import { MongoServerError, type ClientSession, type Db, type UpdateFilter, type MongoClient } from "mongodb";
import { REPORT_UUID } from "@/features/reports/policy";
import { canAccessAdmin, type AccountAccess } from "@/lib/auth/policy";
import type { Report } from "@/lib/reports/service";

const organization = "community";
const actions = ["publish", "hide", "approve", "reject", "handoff", "cancel"] as const;
type Action = typeof actions[number];
const claimTransitions = {
  approve: { from: "pending", to: "approved", lifecycle: "reserved" },
  reject: { from: "pending", to: "rejected", lifecycle: null },
  handoff: { from: "approved", to: "fulfilled", lifecycle: "returned" },
  cancel: { from: "approved", to: "cancelled", lifecycle: "open" },
} as const;
type Decision = {
  action: Action; entityId: string; expected: string; requestId: string;
  reason: string; linkedLostId: string; approvedMedia: string[];
};
type Actor = AccountAccess & { id: string };
type ManagedReport = Report & { reservedClaimId?: string; approvedMedia?: string[]; moderationReason?: string };
type ManagedClaim = {
  _id: string; organization: string; reportId: string; claimantId: string;
  status: "pending" | "approved" | "rejected" | "fulfilled" | "withdrawn" | "cancelled";
  decisionReason?: string;
};
type Receipt = { _id: string; actorId: string; organization: string; fingerprint: string; reason: string };
type Context = { db: Db; session: ClientSession; actorId: string; now: Date };
export class DecisionError extends Error {}

function parseDecision(form: FormData): Decision {
  function field(name: string) {
    const values = form.getAll(name);
    if (values.length > 1 || (values.length && typeof values[0] !== "string"))
      throw new DecisionError("Invalid decision form.");
    return String(values[0] ?? "").trim();
  }
  const selected = field("action");
  const action = actions.find((value) => value === selected);
  if (!action) throw new DecisionError("Choose a valid decision.");
  const entityId = field("entityId"), requestId = field("requestId"), expected = field("expected");
  const reason = field("reason"), linkedLostId = field("linkedLostId");
  if (!REPORT_UUID.test(entityId) || !REPORT_UUID.test(requestId) || !expected)
    throw new DecisionError("Reopen the case and try again.");
  if (linkedLostId && (action !== "handoff" || !REPORT_UUID.test(linkedLostId)))
    throw new DecisionError("Choose a valid linked lost report for handoff.");
  if (action === "handoff" && field("handoffConfirmed") !== "yes")
    throw new DecisionError("Confirm physical handoff before recording the return.");
  if (linkedLostId && field("linkedConfirmed") !== "yes")
    throw new DecisionError("Confirm the linked lost report before recording the return.");
  if (reason.length > 1500 || (!reason && ["hide", "approve", "reject", "cancel"].includes(action)))
    throw new DecisionError("Enter a decision reason of up to 1,500 characters.");
  const approvedMedia = form.getAll("approvedMedia");
  if (!approvedMedia.every((id): id is string => typeof id === "string" && REPORT_UUID.test(id)) ||
      approvedMedia.length > 5 || new Set(approvedMedia).size !== approvedMedia.length ||
      (approvedMedia.length && action !== "publish"))
    throw new DecisionError("Choose up to five different report attachments for publication.");
  return { action, entityId, expected, requestId, reason, linkedLostId, approvedMedia };
}

function unavailable(): never { throw new DecisionError("This case is unavailable."); }
function conflict(state: string): never { throw new DecisionError(`Decision unavailable. Current state: ${state}.`); }

async function moderate({ db, session }: Context, input: Decision) {
  const reports = db.collection<ManagedReport>("reports");
  const scope = { _id: input.entityId, organization } as const;
  const report = await reports.findOne(scope, { session, projection: { moderation: 1, attachments: 1, ownerId: 1 } });
  if (!report) unavailable();
  const from = report.moderation;
  const to = input.action === "publish" ? "published" : "hidden";
  if (from !== input.expected || !(from === "pending" || (input.action === "hide" && from === "published")))
    conflict(from);
  if (input.approvedMedia.length) {
    const count = await db.collection<{ _id: string; reportId: string; ownerId: string }>("report_media")
      .countDocuments({ _id: { $in: input.approvedMedia }, reportId: report._id, ownerId: report.ownerId }, { session });
    if (count !== input.approvedMedia.length || !input.approvedMedia.every(id => report.attachments.includes(id)))
      throw new DecisionError("A selected attachment is unavailable for publication.");
  }
  const result = await reports.updateOne({ ...scope, moderation: from }, { $set: {
    moderation: to, moderationReason: input.reason, approvedMedia: input.approvedMedia,
  } }, { session });
  if (!result.matchedCount) unavailable();
  return { action: `report.${to}`, reportId: report._id, from, to };
}

async function decideClaim({ db, session, actorId, now }: Context, input: Decision, action: keyof typeof claimTransitions) {
  const claims = db.collection<ManagedClaim>("claims");
  const reports = db.collection<ManagedReport>("reports");
  const claimScope = { _id: input.entityId, organization };
  const claim = await claims.findOne(claimScope, { session, projection: { status: 1, reportId: 1, claimantId: 1 } });
  if (!claim) unavailable();
  const reportScope = { _id: claim.reportId, organization, type: "found" } as const;
  const report = await reports.findOne(reportScope, { session, projection: { moderation: 1, lifecycle: 1, reservedClaimId: 1 } });
  if (!report) unavailable();
  const { from, to, lifecycle } = claimTransitions[action];
  if (claim.status !== input.expected || claim.status !== from) conflict(claim.status);
  if (lifecycle) {
    // Older reservations predate the report pointer. The unique approved/fulfilled claim index identifies their claimant.
    const eligible = from === "approved" ? { lifecycle: "reserved" as const, $or: [{ reservedClaimId: claim._id }, { reservedClaimId: { $exists: false } }] }
      : { lifecycle: "open", moderation: "published" } as const;
    const change: UpdateFilter<ManagedReport> = to === "approved" ? { $set: { lifecycle, reservedClaimId: claim._id } }
      : { $set: { lifecycle }, $unset: { reservedClaimId: "" as const } };
    const result = await reports.updateOne({ ...reportScope, ...eligible }, change, { session });
    if (!result.matchedCount) conflict(`${report.moderation}, ${report.lifecycle}`);
  }
  const updated = await claims.updateOne({ ...claimScope, reportId: report._id, status: from },
    { $set: { status: to, ...(input.reason && { decisionReason: input.reason }) } }, { session });
  if (!updated.matchedCount) unavailable();
  if (to === "fulfilled") {
    if (input.linkedLostId) {
      const linked = await reports.updateOne({ _id: input.linkedLostId, organization, type: "lost",
        ownerId: claim.claimantId, lifecycle: "open" }, { $set: { lifecycle: "returned" } }, { session });
      if (!linked.matchedCount) throw new DecisionError("The linked lost report is unavailable for this claimant.");
    }
    await db.collection("return_events").insertOne({ organization, reportId: report._id, claimId: claim._id,
      claimantId: claim.claimantId, actorId, createdAt: now, ...(input.linkedLostId && { linkedLostId: input.linkedLostId }) }, { session });
  }
  return { action: `claim.${to}`, reportId: report._id, claimId: claim._id, from, to,
    ...(lifecycle && { lifecycleFrom: report.lifecycle, lifecycleTo: lifecycle }),
    ...(input.linkedLostId && { linkedLostId: input.linkedLostId }) };
}

export async function ensureDecisionIndexesV1(db: Db) {
  await Promise.all([
    db.collection("claims").createIndex({ organization: 1, reportId: 1 }, { unique: true, name: "staff_reservation_v1",
      partialFilterExpression: { status: { $in: ["approved", "fulfilled"] } } }),
    db.collection("return_events").createIndex({ organization: 1, claimId: 1 }, { unique: true, name: "staff_return_v1" }),
    // Pre-create the receipt collection before opening a transaction. Its _id is the request key.
    db.collection("decision_requests").createIndex({ organization: 1, actorId: 1 }, { name: "staff_requests_v1" }),
  ]);
}

export async function applyAdminDecision(db: Db, client: MongoClient, actor: Actor | null, form: FormData) {
  if (!actor || !canAccessAdmin(actor)) throw new DecisionError("Verified administrator access is required.");
  const input = parseDecision(form);
  const receipts = db.collection<Receipt>("decision_requests");
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  function verifyRetry(receipt: Receipt) {
    if (receipt.organization !== organization || receipt.actorId !== actor?.id || receipt.fingerprint !== fingerprint)
      throw new DecisionError("This confirmation was already used. Reopen the case.");
  }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const receipt = await receipts.findOne({ _id: input.requestId }, { session });
      if (receipt) return verifyRetry(receipt);
      await receipts.insertOne({ _id: input.requestId, organization, actorId: actor.id, fingerprint, reason: input.reason }, { session });
      const ctx = { db, session, actorId: actor.id, now: new Date() };
      const event = input.action === "publish" || input.action === "hide"
        ? await moderate(ctx, input)
        : await decideClaim(ctx, input, input.action);
      await db.collection("audit_events").insertOne({ ...event, entityId: input.entityId, actorId: actor.id,
        organization, requestId: input.requestId, createdAt: ctx.now }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
    const receipt = await receipts.findOne({ _id: input.requestId });
    if (receipt) return verifyRetry(receipt);
    const claim = await db.collection<ManagedClaim>("claims").findOne(
      { organization, _id: input.entityId }, { projection: { status: 1, reportId: 1 } });
    if (!claim) unavailable();
    const report = await db.collection<ManagedReport>("reports").findOne(
      { organization, _id: claim.reportId, type: "found" }, { projection: { lifecycle: 1, moderation: 1 } });
    if (!report) unavailable();
    throw new DecisionError(`A reservation or return is already recorded. Current state: claim ${claim.status}, item ${report.moderation}, ${report.lifecycle}.`);
  } finally {
    await session.endSession();
  }
}

