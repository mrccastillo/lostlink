import type { Db } from "mongodb";
import { canAccessAdmin, type AccountAccess } from "@/lib/auth/policy";
import { REPORT_UUID } from "@/features/reports/policy";
import type { MediaLocation } from "./cloudinary";

type Params = { kind: string; entityId: string; mediaId: string };
type Parent = { _id: string; organization: string; attachments: string[] };
type Report = Parent & { ownerId: string; moderation: string; approvedMedia?: string[] };
type Claim = Parent & { claimantId: string };
type StoredMedia = MediaLocation & { _id: string; ownerId: string; reportId?: string; claimId?: string };

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const locationProjection = { projection: { _id: 0, publicId: 1, resourceType: 1, format: 1 } };

async function findLocation(db: Db, { kind, entityId, mediaId }: Params) {
  const parent = { _id: entityId, organization: "community", attachments: mediaId };
  if (kind === "claim") {
    const claim = await db.collection<Claim>("claims").findOne(parent, { projection: { claimantId: 1 } });
    if (!claim?.claimantId) return null;
    return db.collection<StoredMedia>("claim_evidence").findOne<MediaLocation>({
      _id: mediaId, claimId: entityId, ownerId: claim.claimantId,
    }, locationProjection);
  }
  const report = await db.collection<Report>("reports").findOne({
    ...parent,
    ...(kind === "published" ? { moderation: "published", approvedMedia: { $type: "array" as const, $eq: mediaId } } : {}),
  }, { projection: { ownerId: 1 } });
  if (!report?.ownerId) return null;
  return db.collection<StoredMedia>("report_media").findOne<MediaLocation>({
    _id: mediaId, reportId: entityId, ownerId: report.ownerId,
  }, locationProjection);
}

export async function caseMediaDownload(
  actor: AccountAccess | null,
  params: Params,
  database: () => Promise<{ db: Db }>,
  sign: (location: MediaLocation) => string,
) {
  if (!actor) return new Response(null, { status: 401, headers });
  if (!actor.emailVerified || (params.kind !== "published" && !canAccessAdmin(actor)))
    return new Response(null, { status: 403, headers });
  if (!["published", "report", "claim"].includes(params.kind) ||
      !REPORT_UUID.test(params.entityId) || !REPORT_UUID.test(params.mediaId))
    return new Response(null, { status: 404, headers });
  try {
    const { db } = await database();
    const location = await findLocation(db, params);
    if (!location) return new Response(null, { status: 404, headers });
    return new Response(null, { status: 307, headers: { ...headers, Location: sign(location) } });
  } catch {
    console.error("CASE_MEDIA_DOWNLOAD_UNAVAILABLE");
    return new Response(null, { status: 503, headers });
  }
}
