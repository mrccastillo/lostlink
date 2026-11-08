"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { canPost } from "@/lib/auth/policy";
import { getMediaService, isMediaConfigured } from "@/lib/media/runtime";
import { MediaError } from "@/lib/media/policy";
import type { MediaSummary } from "@/lib/media/service";

export type AttachmentAccess =
  | { status: "guest" | "unverified" }
  | { status: "unavailable"; message: string }
  | { status: "ready"; files: MediaSummary[] };

export async function loadPostAttachments(): Promise<AttachmentAccess> {
  try {
    const session = await getCurrentSession();
    if (!session) return { status: "guest" };
    if (!canPost(session.user)) return { status: "unverified" };
    if (!isMediaConfigured()) return { status: "unavailable", message: "Attachments will be available once media storage is configured." };
    const service = await getMediaService();
    return { status: "ready", files: await service.list(session.user) };
  } catch {
    console.error("MEDIA_LIST_FAILED");
    return { status: "unavailable", message: "Attachments are temporarily unavailable. Please try again." };
  }
}

export type MediaActionState = { message: string; success: boolean; downloadUrl?: string; attachmentId?: string };

export async function manageAttachment(
  _previous: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    const session = await getCurrentSession();
    if (!session || !canPost(session.user))
      throw new MediaError("Sign in with a verified account first.");
    const operation = formData.get("operation");
    const id = formData.get("id");
    if (!["upload", "download", "remove"].includes(String(operation)))
      throw new MediaError("Choose an attachment action.");
    const service = await getMediaService();
    if (operation === "upload") {
      const file = formData.get("file");
      if (!(file instanceof File) || !file.size)
        throw new MediaError("Choose a file to upload.");
      const attachmentId = await service.upload(session.user, file);
      return { message: "Attachment uploaded privately.", success: true, attachmentId };
    }
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
      throw new MediaError("This attachment is unavailable.");
    if (operation === "download") {
      const downloadUrl = await service.download(session.user, id);
      return { message: "Your download link expires in one minute.", success: true, downloadUrl };
    }
    await service.remove(session.user, id);
    return { message: "Attachment removed.", success: true };
  } catch (error) {
    if (error instanceof MediaError) return { message: error.message, success: false };
    console.error("MEDIA_ACTION_FAILED");
    return { message: "Attachments are temporarily unavailable. Please try again later.", success: false };
  }
}
