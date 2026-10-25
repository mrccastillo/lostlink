"use client";

import { useActionState, useState } from "react";
import { manageAttachment, type MediaActionState } from "./actions";
import { MEDIA_ACCEPT, MEDIA_MAX_ATTACHMENTS } from "@/lib/media/policy";
import type { MediaSummary } from "@/lib/media/service";
import { toast } from "@/components/toasts";

export function AttachmentForm({ files }: { files: MediaSummary[] }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: MediaActionState, formData: FormData) => {
      const uploading = formData.get("operation") === "upload";
      if (uploading && selectedFile) formData.set("file", selectedFile);
      let result: MediaActionState;
      try {
        result = await manageAttachment(previous, formData);
      } catch {
        result = {
          success: false,
          message: "We couldn’t reach attachment services. Please try again.",
        };
      }
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      // React resets uncontrolled fields after actions; retain the selected file
      // in memory so a recoverable provider failure can be retried.
      if (uploading && result.success) setSelectedFile(null);
      return result;
    },
    { message: "", success: false },
  );
  return (
    <section className="attachment-panel" aria-labelledby="attachments-title">
      <h2 id="attachments-title">Your private attachments</h2>
      <p>Upload up to five files. JPEG, PNG, or WebP images up to 5 MB; MP4 or WebM videos up to 20 MB.</p>
      <p>Only you can access these attachments. They expire after 24 hours. Report and claim forms are still being prepared.</p>
      <form action={action}>
        <fieldset disabled={pending}>
          <label htmlFor="attachment-file">Choose an image or video</label>
          <input
            id="attachment-file" type="file" name="file" accept={MEDIA_ACCEPT}
            required={!selectedFile}
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          {selectedFile && <p>Selected: {selectedFile.name}</p>}
          <button type="submit" name="operation" value="upload" disabled={files.length >= MEDIA_MAX_ATTACHMENTS}>
            {pending ? "Please wait…" : "Upload attachment"}
          </button>
        </fieldset>
      </form>
      {files.length === 0 ? <p>No attachments yet.</p> : (
        <ul>
          {files.map((file, index) => (
            <li key={file.id}>
              <span>{file.kind === "image" ? "Image" : "Video"} {index + 1}</span>
              <form action={action}>
                <input type="hidden" name="id" value={file.id} />
                <button name="operation" value="download" disabled={pending}>Get download link</button>
                <button name="operation" value="remove" disabled={pending}>Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {state.downloadUrl && <a href={state.downloadUrl} rel="noreferrer">Download attachment</a>}
    </section>
  );
}
