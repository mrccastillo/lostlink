"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { canPost } from "@/lib/auth/policy";
import { getMediaService } from "@/lib/media/runtime";
import { MediaError } from "@/lib/media/policy";

export type MediaActionState = { message: string; success: boolean; downloadUrl?: string };

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
      await service.upload(session.user, file);
      revalidatePath("/post");
      return { message: "Attachment uploaded privately.", success: true };
    }
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
      throw new MediaError("This attachment is unavailable.");
    if (operation === "download") {
      const downloadUrl = await service.download(session.user, id);
      return { message: "Your download link expires in one minute.", success: true, downloadUrl };
    }
    await service.remove(session.user, id);
    revalidatePath("/post");
    return { message: "Attachment removed.", success: true };
  } catch (error) {
    if (error instanceof MediaError) return { message: error.message, success: false };
    console.error("MEDIA_ACTION_FAILED");
    return { message: "Attachments are temporarily unavailable. Please try again later.", success: false };
  }
}
