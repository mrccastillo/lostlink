import { getCurrentSession } from "@/lib/auth/session";
import { attachmentPreview } from "@/lib/media/preview";
import { getMediaService } from "@/lib/media/runtime";

export async function GET(_request: Request, context: RouteContext<"/api/attachments/[id]/preview">) {
  const session = await getCurrentSession();
  const { id } = await context.params;
  return attachmentPreview(session?.user ?? null, id, getMediaService);
}
