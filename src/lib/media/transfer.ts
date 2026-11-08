import type { ClientSession, Db } from "mongodb";
import { MediaError } from "./policy";

type Upload = { _id: string; ownerId: string; status: string; expiresAt: Date; publicId: string; resourceType: "image" | "video"; format: string };

// Caller creates the parent record in this same transaction. Only ready,
// unexpired uploads owned by the verified actor may become permanent evidence.
export async function transferTemporaryMedia(db: Db, session: ClientSession, ownerId: string, ids: string[], target: { kind: "report" | "claim"; id: string }) {
  if (!ids.length) return;
  const uploads = db.collection<Upload>("media_uploads");
  const files = await uploads.find({ _id: { $in: ids }, ownerId, status: "ready", expiresAt: { $gt: new Date() } }, { session }).toArray();
  if (files.length !== ids.length) throw new MediaError("An attachment is unavailable. Remove it or upload it again.");
  const collection = target.kind === "report" ? "report_media" : "claim_evidence";
  const references = target.kind === "report" ? { reportId: target.id } : { claimId: target.id };
  await db.collection<{ _id: string; ownerId: string; publicId: string; resourceType: string; format: string; reportId?: string; claimId?: string }>(collection).insertMany(files.map((file) => ({ _id: file._id, ownerId, publicId: file.publicId, resourceType: file.resourceType, format: file.format, ...references })), { session });
  await uploads.deleteMany({ _id: { $in: ids }, ownerId, status: "ready" }, { session });
}
