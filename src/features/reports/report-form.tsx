"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { MediaSummary } from "@/lib/media/service";
import { toast } from "@/components/toasts";
import { REPORT_CATEGORIES } from "./policy";
import { submitReport } from "./actions";
import { AttachmentForm } from "@/features/media/attachment-form";

export function ReportForm({ files, onSubmitted, onAttachmentsChanged }: { files: MediaSummary[]; onSubmitted: () => void; onAttachmentsChanged?: () => Promise<void> }) {
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState({ type: "lost", title: "", category: "", location: "", occurredOn: "", description: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, action, pending] = useActionState(async (_previous: { success: boolean; message: string }, data: FormData) => {
    let response;
    if (Number(data.get("pendingAttachments")) > 0) {
      const message = "Upload your selected photos and videos before submitting.";
      toast.error(message);
      return { success: false, message };
    }
    try { response = await submitReport(data); }
    catch { response = { success: false, message: "We couldn’t reach report services. Please try again." }; }
    if (response.success) { toast.success(response.message); onSubmitted(); router.refresh(); }
    else toast.error(response.message);
    return response;
  }, { success: false, message: "" });
  function update(field: keyof typeof values, value: string) { setValues((current) => ({ ...current, [field]: value })); }
  const maxDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return (
    <form action={action} className="report-form">
      <input type="hidden" name="requestId" value={requestId} />
      {selected.map((id) => <input key={id} type="hidden" name="attachments" value={id} />)}
      <fieldset disabled={pending}>
        <legend className="sr-only">Item report details</legend>
        <div className="report-type-picker" role="group" aria-label="Report type">
          {[ ["lost", "I lost something"], ["found", "I found something"] ].map(([value, label]) => <label key={value}><input type="radio" name="type" value={value} checked={values.type === value} onChange={() => update("type", value)} /><span>{label}</span></label>)}
        </div>
        <label className="report-field">Item title<input name="title" value={values.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Black wireless headphones" required minLength={3} maxLength={100} /></label>
        <div className="report-field-row">
          <label className="report-field">Category<select name="category" required value={values.category} onChange={(event) => update("category", event.target.value)}><option value="">Choose a category</option>{REPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="report-field">Date {values.type === "lost" ? "lost" : "found"}<input type="date" name="occurredOn" required max={maxDate} value={values.occurredOn} onChange={(event) => update("occurredOn", event.target.value)} /></label>
        </div>
        <label className="report-field">Location<input name="location" required minLength={2} maxLength={120} value={values.location} onChange={(event) => update("location", event.target.value)} placeholder="e.g. Library, second floor" /></label>
        <label className="report-field">Description<textarea name="description" required minLength={10} maxLength={1500} rows={4} value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the item’s appearance and where it was last seen." aria-describedby="report-privacy" /></label>
        <p id="report-privacy" className="report-hint">Keep serial numbers, hidden identifying details, and contact information private. Reports are reviewed before appearing on the board.</p>
        {onAttachmentsChanged && <AttachmentForm files={files} selected={selected} onSelect={(id, include) => setSelected((current) => include ? [...new Set([...current, id])] : current.filter((value) => value !== id))} onChanged={onAttachmentsChanged} onBusyChange={setUploading} disabled={pending} />}
        {result.message && !result.success && <p className="report-error" role="alert">{result.message}</p>}
        <button type="submit" className="button button-yellow report-submit" disabled={uploading}>{pending ? "Submitting…" : uploading ? "Uploading files…" : "Submit report for review"}</button>
      </fieldset>
    </form>
  );
}
