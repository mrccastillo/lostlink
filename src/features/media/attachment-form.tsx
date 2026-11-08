"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { manageAttachment } from "./actions";
import { MEDIA_ACCEPT, MEDIA_MAX_ATTACHMENTS, IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from "@/lib/media/policy";
import type { MediaSummary } from "@/lib/media/service";

type Preview = { key: string; file: File; url: string; id?: string; error?: string };
type Props = {
  files: MediaSummary[]; selected: string[]; onSelect: (id: string, selected: boolean) => void;
  onChanged: () => Promise<void>; onBusyChange: (busy: boolean) => void; disabled: boolean;
  label?: string;
};

export function AttachmentForm({ files, selected, onSelect, onChanged, onBusyChange, disabled, label = "Photos & video" }: Props) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const working = useRef(false);
  const dragDepth = useRef(0);
  const headingId = useId();
  const hintId = useId();
  useEffect(() => {
    const activeUrls = urls.current;
    return () => { for (const url of activeUrls) URL.revokeObjectURL(url); activeUrls.clear(); };
  }, []);
  function addFiles(incoming: File[]) {
    if (disabled || working.current) return;
    const available = MEDIA_MAX_ATTACHMENTS - files.length - previews.filter((preview) => !preview.id).length;
    if (incoming.length > available) { setMessage("You can add up to five files. Remove one before adding more."); return; }
    if (incoming.some((file) => !MEDIA_ACCEPT.split(",").includes(file.type) || !file.size || file.size > (file.type.startsWith("video/") ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES))) {
      setMessage("Choose JPEG, PNG, or WebP images up to 5 MB, or MP4/WebM videos up to 20 MB."); return;
    }
    setMessage("");
    const additions = incoming.map((file) => {
      const url = URL.createObjectURL(file); urls.current.add(url);
      return { key: crypto.randomUUID(), file, url };
    });
    setPreviews((current) => [...current, ...additions]);
  }
  async function upload() {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); onBusyChange(true); setMessage("");
    try {
      for (const preview of previews.filter((entry) => !entry.id)) {
        const data = new FormData(); data.set("operation", "upload"); data.set("file", preview.file);
        const result = await manageAttachment({ success: false, message: "" }, data);
        if (result.success && result.attachmentId) {
          const id = result.attachmentId;
          setPreviews((current) => current.map((entry) => entry.key === preview.key ? { ...entry, id, error: undefined } : entry));
          onSelect(id, true);
        } else setPreviews((current) => current.map((entry) => entry.key === preview.key ? { ...entry, error: result.message } : entry));
      }
      await onChanged();
    } catch { setMessage("We couldn’t finish uploading. Your files are still here; please try again."); }
    finally { working.current = false; setBusy(false); onBusyChange(false); }
  }
  async function remove(preview: Preview | undefined, id?: string) {
    if (working.current || disabled) return;
    if (id) {
      working.current = true; setBusy(true); onBusyChange(true);
      try {
        const data = new FormData(); data.set("operation", "remove"); data.set("id", id);
        const result = await manageAttachment({ success: false, message: "" }, data);
        if (!result.success) { setMessage(result.message); return; }
        onSelect(id, false); await onChanged();
      } catch { setMessage("Couldn’t remove this file. Please try again."); return; }
      finally { working.current = false; setBusy(false); onBusyChange(false); }
    }
    if (preview) {
      URL.revokeObjectURL(preview.url); urls.current.delete(preview.url);
      setPreviews((current) => current.filter((entry) => entry.key !== preview.key));
    }
  }
  const staged = previews.filter((preview) => !preview.id);
  return (
    <section className="attachment-panel" aria-labelledby={headingId}>
      <input type="hidden" name="pendingAttachments" value={staged.length} />
      <h2 id={headingId}>{label} <span>(optional)</span></h2>
      <div className={`media-dropzone${dragging ? " is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); dragDepth.current++; setDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = disabled || busy ? "none" : "copy"; }} onDragLeave={(event) => { event.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }} onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
        <input ref={input} className="sr-only" type="file" multiple accept={MEDIA_ACCEPT} aria-label="Choose photos or videos" aria-describedby={hintId} disabled={disabled || busy} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <button className="media-browse" type="button" disabled={disabled || busy} onClick={() => input.current?.click()}><span className="media-upload-icon" aria-hidden="true">↑</span><strong>Drag photos or videos here</strong><span>or <u>browse files</u></span></button>
        <p id={hintId}>Up to 5 files · Images 5 MB · Videos 20 MB<br />JPEG, PNG, WebP, MP4, WebM</p>
      </div>
      {(previews.length > 0 || files.length > 0) && <ul className="media-previews">
        {previews.map((preview) => <li key={preview.key} className="media-preview"><div className="media-preview-visual">{preview.file.type.startsWith("video/") ? <video src={preview.url} controls preload="metadata" aria-label={preview.file.name} /> : <Image src={preview.url} alt={preview.file.name} width={200} height={150} unoptimized />}</div><p title={preview.file.name}>{preview.file.name}</p>{preview.id ? <label className="media-include"><input type="checkbox" checked={selected.includes(preview.id)} onChange={(event) => { if (preview.id) onSelect(preview.id, event.target.checked); }} disabled={disabled || busy} />Include in report</label> : <span className="media-preview-status">{busy ? "Uploading…" : "Ready to upload"}</span>}{preview.error && <p className="report-error" role="alert">{preview.error}</p>}<button type="button" className="media-remove" disabled={disabled || busy} onClick={() => void remove(preview, preview.id)} aria-label={`Remove ${preview.file.name}`}>Remove</button></li>)}
        {files.filter((file) => !previews.some((preview) => preview.id === file.id)).map((file, index) => <li key={file.id} className="media-preview"><div className="media-existing-placeholder">{file.kind === "image" ? "Image" : "Video"}<span>Previously uploaded</span></div><p>{file.kind === "image" ? "Image" : "Video"} {index + 1}</p><label className="media-include"><input type="checkbox" checked={selected.includes(file.id)} disabled={disabled || busy} onChange={(event) => onSelect(file.id, event.target.checked)} />Include in report</label><button type="button" className="media-remove" disabled={disabled || busy} onClick={() => void remove(undefined, file.id)}>Remove</button></li>)}
      </ul>}
      {staged.length > 0 && <button type="button" className="media-upload-button" onClick={() => void upload()} disabled={disabled || busy}>{busy ? "Uploading…" : `Upload ${staged.length === 1 ? "file" : `${staged.length} files`}`}</button>}
      {message && <p className="report-error" role="alert">{message}</p>}
      <p className="report-hint">Upload your selected files before submitting. Uploaded files are included automatically.</p>
    </section>
  );
}
