import { getCurrentSession } from "@/lib/auth/session";
import { caseMediaDownload } from "@/lib/media/case-download";
import { createCloudinaryStorage } from "@/lib/media/cloudinary";
import { readCloudinaryConfig } from "@/lib/media/config";
import { getDomainDatabase } from "@/lib/mongodb";

export async function GET(_request: Request, context: RouteContext<"/api/case-media/[kind]/[entityId]/[mediaId]">) {
  const session = await getCurrentSession();
  return caseMediaDownload(session?.user ?? null, await context.params, getDomainDatabase, (location) => {
    const config = readCloudinaryConfig(process.env);
    if (!config) throw new Error("MEDIA_NOT_CONFIGURED");
    return createCloudinaryStorage(config).download(location);
  });
}
