import type { Db, MongoClient } from "mongodb";
import { REPORT_CATEGORIES, REPORT_UUID, ReportError, validateReport, type ReportInput } from "@/features/reports/policy";
import { transferTemporaryMedia } from "@/lib/media/transfer";

type Actor = { id: string; emailVerified: boolean };
type Report = Omit<ReportInput, "requestId"> & { _id: string; ownerId: string; organization: "community"; moderation: "pending" | "published" | "hidden"; lifecycle: "open" | "reserved" | "returned" | "archived"; createdAt: Date };

export function createReportService(db: Db, client: MongoClient) {
  return {
    async listOwn(actor: Actor | null, options: { cursor?: string; type?: "lost" | "found" } = {}) {
      if (!actor?.emailVerified) throw new ReportError("Sign in with a verified account to view your posts.");
      let before: { date: Date; id: string } | undefined;
      if (options.cursor) {
        const [timestamp, id, extra] = options.cursor.split("_");
        const date = new Date(timestamp);
        if (extra || !id || !REPORT_UUID.test(id) || !Number.isFinite(date.getTime()) || date.toISOString() !== timestamp) throw new ReportError("This page link is invalid. Return to the first page.");
        before = { date, id };
      }
      const records = await db.collection<Report>("reports").find({
        ownerId: actor.id, organization: "community", ...(options.type ? { type: options.type } : {}),
        ...(before ? { $or: [{ createdAt: { $lt: before.date } }, { createdAt: before.date, _id: { $lt: before.id } }] } : {}),
      }, { projection: { _id: 1, type: 1, title: 1, category: 1, location: 1, occurredOn: 1, description: 1, moderation: 1, lifecycle: 1, createdAt: 1, attachments: 1 } }).sort({ createdAt: -1, _id: -1 }).limit(21).toArray();
      const page = records.slice(0, 20);
      const last = page.at(-1);
      return {
        items: page.map((record) => ({ id: record._id, type: record.type, title: record.title, category: record.category, location: record.location, occurredOn: record.occurredOn, description: record.description, moderation: record.moderation, lifecycle: record.lifecycle, createdAt: record.createdAt.toISOString(), attachmentCount: record.attachments.length })),
        nextCursor: records.length > 20 && last ? `${last.createdAt.toISOString()}_${last._id}` : null,
      };
    },
    async submit(actor: Actor | null, raw: ReportInput) {
      if (!actor?.emailVerified) throw new ReportError("Sign in with a verified account before posting.");
      const input = validateReport(raw);
      const reports = db.collection<Report>("reports");
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          const existing = await reports.findOne({ _id: input.requestId }, { session });
          if (existing) {
            if (existing.ownerId !== actor.id) throw new ReportError("Please reopen the form and try again.");
            return;
          }
          const now = new Date();
          const counter = await db.collection<{ _id: string; count: number; expiresAt: Date }>("report_limits").findOneAndUpdate(
            { _id: `${actor.id}:${Math.floor(now.getTime() / 3_600_000)}` },
            { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + 7_200_000) } },
            { upsert: true, returnDocument: "after", session },
          );
          if (!counter || counter.count > 5) throw new ReportError("You can submit five reports per hour. Please try again later.");
          const { requestId, ...details } = input;
          await reports.insertOne({ ...details, _id: requestId, ownerId: actor.id, organization: "community", moderation: "pending", lifecycle: "open", createdAt: now }, { session });
          await transferTemporaryMedia(db, session, actor.id, input.attachments, { kind: "report", id: requestId });
          await db.collection("audit_events").insertOne({ actorId: actor.id, organization: "community", action: "report.submitted", entityId: requestId, createdAt: now }, { session });
        });
      } catch (error) {
        // Concurrent retries may reach a unique key before seeing the winning
        // transaction. Only acknowledge an existing report owned by this actor.
        if (!(error instanceof Error) || !("code" in error) || error.code !== 11000 || !await reports.findOne({ _id: input.requestId, ownerId: actor.id })) throw error;
      } finally { await session.endSession(); }
      return input.requestId;
    },
  };
}

export async function ensureReportSchemaV1(db: Db) {
  if (!(await db.listCollections({ name: "reports" }).hasNext())) {
    try { await db.createCollection("reports"); }
    catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== 48) throw error; }
  }
  await db.command({ collMod: "reports", validator: { $jsonSchema: {
    bsonType: "object", required: ["_id", "ownerId", "organization", "type", "title", "category", "location", "occurredOn", "description", "attachments", "moderation", "lifecycle", "createdAt"],
    properties: {
      _id: { bsonType: "string" }, ownerId: { bsonType: "string" }, organization: { enum: ["community"] },
      type: { enum: ["lost", "found"] }, title: { bsonType: "string", minLength: 3, maxLength: 100 },
      category: { enum: [...REPORT_CATEGORIES] }, location: { bsonType: "string", minLength: 2, maxLength: 120 },
      description: { bsonType: "string", minLength: 10, maxLength: 1500 }, occurredOn: { bsonType: "string" },
      attachments: { bsonType: "array", maxItems: 5, uniqueItems: true, items: { bsonType: "string" } },
      moderation: { enum: ["pending", "published", "hidden"] }, lifecycle: { enum: ["open", "reserved", "returned", "archived"] }, createdAt: { bsonType: "date" },
    },
  } } });
  await Promise.all([
    db.collection("reports").createIndex({ ownerId: 1, createdAt: -1 }, { name: "reports_owner_v1" }),
    db.collection("reports").createIndex({ ownerId: 1, organization: 1, createdAt: -1, _id: -1 }, { name: "reports_owner_page_v2" }),
    db.collection("report_media").createIndex({ reportId: 1 }, { name: "report_media_report_v1" }),
    db.collection("report_limits").createIndex({ expiresAt: 1 }, { name: "report_rate_expiry_v1", expireAfterSeconds: 0 }),
  ]);
}
