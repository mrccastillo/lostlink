import type { Db, MongoClient } from "mongodb";
import { ClaimError, validateClaim, type ClaimInput } from "@/features/claims/policy";
import { transferTemporaryMedia } from "@/lib/media/transfer";

type Actor = { id: string; emailVerified: boolean };
type Item = { _id: string; ownerId: string; organization: string; type: string; title: string; category: string; location: string; occurredOn: string; moderation: string; lifecycle: string; claimRevision?: number };
type Claim = Omit<ClaimInput, "requestId" | "confirmed"> & { _id: string; claimantId: string; organization: "community"; status: "pending" | "approved" | "rejected" | "withdrawn" | "fulfilled" | "cancelled"; createdAt: Date };
export type ClaimItem = { id: string; title: string; category: string; location: string; occurredOn: string; available: boolean };
export type ClaimSummary = { id: string; status: Claim["status"]; createdAt: string };

export function createClaimService(db: Db, client: MongoClient) {
  const claims = db.collection<Claim>("claims");
  const reports = db.collection<Item>("reports");
  function authorize(actor: Actor | null): asserts actor is Actor { if (!actor?.emailVerified) throw new ClaimError("Sign in with a verified account to claim an item."); }
  return {
    async list(actor: Actor | null) {
      authorize(actor);
      const records = await claims.find({ claimantId: actor.id, organization: "community" }, { projection: { _id: 1, reportId: 1, status: 1, createdAt: 1 } }).sort({ createdAt: -1, _id: -1 }).limit(50).toArray();
      return records.map((claim) => ({ id: claim._id, reportId: claim.reportId, status: claim.status, createdAt: claim.createdAt.toISOString() }));
    },
    async load(actor: Actor | null, reportId: string): Promise<{ item: ClaimItem; claim: ClaimSummary | null } | null> {
      authorize(actor);
      const item = await reports.findOne({ _id: reportId, organization: "community", type: "found", moderation: "published", ownerId: { $ne: actor.id } }, { projection: { title: 1, category: 1, location: 1, occurredOn: 1, lifecycle: 1 } });
      if (!item) return null;
      const claim = await claims.findOne({ reportId, claimantId: actor.id, organization: "community" }, { sort: { createdAt: -1 }, projection: { _id: 1, status: 1, createdAt: 1 } });
      return { item: { id: item._id, title: item.title, category: item.category, location: item.location, occurredOn: item.occurredOn, available: item.lifecycle === "open" }, claim: claim ? { id: claim._id, status: claim.status, createdAt: claim.createdAt.toISOString() } : null };
    },
    async submit(actor: Actor | null, raw: ClaimInput) {
      authorize(actor);
      const input = validateClaim(raw);
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          const existing = await claims.findOne({ _id: input.requestId }, { session });
          if (existing) {
            if (existing.claimantId !== actor.id || existing.reportId !== input.reportId) throw new ClaimError("Please reopen this item and try again.");
            return;
          }
          const now = new Date();
          // A write guards eligibility against simultaneous reservation/moderation.
          const eligible = await reports.updateOne({ _id: input.reportId, organization: "community", ownerId: { $ne: actor.id }, type: "found", moderation: "published", lifecycle: "open" }, { $inc: { claimRevision: 1 } }, { session });
          if (!eligible.matchedCount) throw new ClaimError("This item is unavailable for claims.");
          const counter = await db.collection<{ _id: string; count: number; expiresAt: Date }>("claim_limits").findOneAndUpdate({ _id: `${actor.id}:${Math.floor(now.getTime() / 3_600_000)}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + 7_200_000) } }, { upsert: true, returnDocument: "after", session });
          if (!counter || counter.count > 5) throw new ClaimError("You can submit five claims per hour. Please try again later.");
          await claims.insertOne({ _id: input.requestId, reportId: input.reportId, claimantId: actor.id, organization: "community", identifyingDetail: input.identifyingDetail, circumstances: input.circumstances, additionalContext: input.additionalContext, attachments: input.attachments, status: "pending", createdAt: now }, { session });
          await transferTemporaryMedia(db, session, actor.id, input.attachments, { kind: "claim", id: input.requestId });
          await db.collection("audit_events").insertOne({ actorId: actor.id, organization: "community", action: "claim.submitted", entityId: input.requestId, createdAt: now }, { session });
        });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === 11000) {
          const duplicate = await claims.findOne({ reportId: input.reportId, claimantId: actor.id, organization: "community", status: { $in: ["pending", "approved", "fulfilled"] } });
          if (duplicate) return duplicate._id;
        }
        throw error;
      } finally { await session.endSession(); }
      return input.requestId;
    },
  };
}

export async function ensureClaimSchemaV1(db: Db) {
  if (!(await db.listCollections({ name: "claims" }).hasNext())) {
    try { await db.createCollection("claims"); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== 48) throw error; }
  }
  await db.command({ collMod: "claims", validator: { $jsonSchema: { bsonType: "object", required: ["_id", "reportId", "claimantId", "organization", "identifyingDetail", "circumstances", "additionalContext", "attachments", "status", "createdAt"], properties: {
    _id: { bsonType: "string" }, reportId: { bsonType: "string" }, claimantId: { bsonType: "string" }, organization: { enum: ["community"] }, identifyingDetail: { bsonType: "string", minLength: 10, maxLength: 1500 }, circumstances: { bsonType: "string", minLength: 10, maxLength: 1500 }, additionalContext: { bsonType: "string", maxLength: 1500 }, attachments: { bsonType: "array", maxItems: 5, uniqueItems: true, items: { bsonType: "string" } }, status: { enum: ["pending", "approved", "rejected", "withdrawn", "fulfilled", "cancelled"] }, createdAt: { bsonType: "date" },
  } } } });
  await Promise.all([
    claimsIndex(db),
    db.collection("claims").createIndex({ claimantId: 1, reportId: 1, createdAt: -1 }, { name: "claims_owner_v1" }),
    db.collection("claim_evidence").createIndex({ claimId: 1 }, { name: "claim_evidence_parent_v1" }),
    db.collection("claim_limits").createIndex({ expiresAt: 1 }, { name: "claim_rate_expiry_v1", expireAfterSeconds: 0 }),
  ]);
}
async function claimsIndex(db: Db) { await db.collection("claims").createIndex({ claimantId: 1, reportId: 1 }, { unique: true, name: "claims_active_unique_v1", partialFilterExpression: { status: { $in: ["pending", "approved", "fulfilled"] } } }); }
