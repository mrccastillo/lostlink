import { getCurrentSession } from "@/lib/auth/session";
import { canPost } from "@/lib/auth/policy";
import { getMediaService, isMediaConfigured } from "@/lib/media/runtime";
import { AttachmentForm } from "./attachment-form";
import type { MediaSummary } from "@/lib/media/service";

export async function Attachments() {
  const session = await getCurrentSession();
  if (!session || !canPost(session.user)) return null;
  if (!isMediaConfigured())
    return <p className="auth-notice">Attachments will be available once media storage is configured.</p>;
  let files: MediaSummary[];
  try {
    const service = await getMediaService();
    files = await service.list(session.user);
  } catch {
    console.error("MEDIA_LIST_FAILED");
    return <p role="status">Attachments are temporarily unavailable. Please try again later.</p>;
  }
  return <AttachmentForm files={files} />;
}
