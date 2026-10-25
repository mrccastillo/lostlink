import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { canPost } from "@/lib/auth/policy";
import type { MediaLocation, MediaStorage } from "./cloudinary";
import {
  MediaError, MEDIA_MAX_ATTACHMENTS, MEDIA_RETENTION_MS,
} from "./policy";
import { prepareMedia } from "./prepare";

type Actor = { id: string; emailVerified: boolean };
type MediaRecord = MediaLocation & {
  _id: string;
  ownerId: string;
  slot: number;
  status: "uploading" | "ready" | "deleting";
  createdAt: Date;
  expiresAt: Date;
};

export type MediaSummary = { id: string; kind: "image" | "video"; expiresAt: string };

// Internal service: actor must come from the verified server session. Client
// requests never choose an owner, storage path, or delivery URL.
export function createMediaService(db: Db, storage: MediaStorage) {
  const records = db.collection<MediaRecord>("media_uploads");
  const limits = db.collection<{ _id: string; count: number; expiresAt: Date }>("media_limits");
  function authorize(actor: Actor | null): asserts actor is Actor {
    if (!actor || !canPost(actor))
      throw new MediaError("Sign in with a verified account to upload files.");
  }
  async function owned(actor: Actor | null, id: string) {
    authorize(actor);
    const record = await records.findOne({
      _id: id, ownerId: actor.id, status: "ready", expiresAt: { $gt: new Date() },
    });
    if (!record) throw new MediaError("This attachment is unavailable.");
    return record;
  }
  return {
    async list(actor: Actor | null): Promise<MediaSummary[]> {
      authorize(actor);
      const files = await records.find({
        ownerId: actor.id, status: "ready", expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 }).limit(MEDIA_MAX_ATTACHMENTS).toArray();
      return files.map((file) => ({
        id: file._id, kind: file.resourceType, expiresAt: file.expiresAt.toISOString(),
      }));
    },
    async upload(actor: Actor | null, file: File) {
      authorize(actor);
      const now = new Date();
      const window = Math.floor(now.getTime() / 60_000);
      const limit = await limits.findOneAndUpdate(
        { _id: `${actor.id}:${window}` },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + 120_000) } },
        { upsert: true, returnDocument: "after" },
      );
      if (!limit || limit.count > 5)
        throw new MediaError("Too many upload attempts. Please wait a minute.");
      const media = await prepareMedia(file);
      const id = randomUUID();
      const location: MediaLocation = {
        publicId: `lostlink/attachments/${id}`,
        resourceType: media.resourceType,
        format: media.format,
      };
      let reserved = false;
      for (let slot = 0; slot < MEDIA_MAX_ATTACHMENTS; slot++) {
        try {
          await records.insertOne({
            _id: id, ownerId: actor.id, slot, ...location, status: "uploading",
            createdAt: now, expiresAt: new Date(now.getTime() + MEDIA_RETENTION_MS),
          });
          reserved = true;
          break;
        } catch (error) {
          if (!(error instanceof Error) || !("code" in error) || error.code !== 11000) throw error;
        }
      }
      if (!reserved) throw new MediaError("You can keep up to five attachments. Remove one first.");
      try {
        await storage.upload(location.publicId, media);
        await records.updateOne({ _id: id, status: "uploading" }, { $set: { status: "ready" } });
      } catch {
        // Keep a durable cleanup record even if the provider or DB is down.
        await records.updateOne({ _id: id }, { $set: { expiresAt: now } });
        throw new MediaError("Upload failed. Please try again later.");
      }
    },
    async download(actor: Actor | null, id: string) {
      return storage.download(await owned(actor, id));
    },
    async remove(actor: Actor | null, id: string) {
      const record = await owned(actor, id);
      await records.updateOne({ _id: id, ownerId: record.ownerId }, {
        $set: { status: "deleting", expiresAt: new Date() },
      });
      await storage.remove(record);
      await records.deleteOne({ _id: id, status: "deleting" });
    },
    async cleanup() {
      const expired = await records.find({ expiresAt: { $lte: new Date() } })
        .sort({ expiresAt: 1 }).limit(100).toArray();
      let removed = 0;
      for (const record of expired) {
        // Do not TTL-delete these records: the provider deletion must finish first.
        await storage.remove(record);
        await records.deleteOne({ _id: record._id });
        removed++;
      }
      return removed;
    },
  };
}

// Versioned, idempotent setup. Unique slots enforce the attachment cap under
// concurrent requests, independently of the application-level checks.
export async function ensureMediaIndexesV1(db: Db) {
  await Promise.all([
    db.collection("media_uploads").createIndex({ ownerId: 1, slot: 1 }, {
      unique: true, name: "media_owner_slot_v1",
    }),
    db.collection("media_uploads").createIndex({ expiresAt: 1 }, { name: "media_cleanup_v1" }),
    db.collection("media_limits").createIndex({ expiresAt: 1 }, {
      expireAfterSeconds: 0, name: "media_rate_expiry_v1",
    }),
  ]);
}
