"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AttachmentForm } from "@/features/media/attachment-form";
import { loadPostAttachments, type AttachmentAccess } from "@/features/media/actions";
import { toast } from "@/components/toasts";
import { submitClaim } from "./actions";

export function ClaimForm({ reportId, preview }: { reportId: string; preview: boolean }) {
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState({ identifyingDetail: "", circumstances: "", additionalContext: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [access, setAccess] = useState<AttachmentAccess | null>(null);
  async function reload() { try { setAccess(await loadPostAttachments()); } catch { setAccess({ status: "unavailable", message: "Proof uploads are temporarily unavailable. Your written answers can still be submitted." }); } }
  useEffect(() => {
    if (preview) return;
    let active = true;
    loadPostAttachments().then((value) => { if (active) setAccess(value); }, () => { if (active) setAccess({ status: "unavailable", message: "Proof uploads are temporarily unavailable." }); });
    return () => { active = false; };
  }, [preview]);
  const [result, action, pending] = useActionState(async (_previous: { success: boolean; message: string }, data: FormData) => {
    if (Number(data.get("pendingAttachments")) > 0) return { success: false, message: "Upload or remove your selected proof files before submitting." };
    if (preview) return { success: true, message: "Preview complete. No claim or proof was saved or sent. Open a live found-item report to make a real claim." };
    let response;
    try { response = await submitClaim(data); } catch { response = { success: false, message: "We couldn’t reach claim services. Your answers are still here; please try again." }; }
    if (response.success) { toast.success(response.message); router.refresh(); }
    else toast.error(response.message);
    return response;
  }, { success: false, message: "" });
  function update(field: keyof typeof values, value: string) { setValues((current) => ({ ...current, [field]: value })); }
  return (
    <form action={action} className="claim-form report-form">
      <input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="reportId" value={reportId} />
      {selected.map((id) => <input key={id} type="hidden" name="attachments" value={id} />)}
      <fieldset disabled={pending || result.success}>
        <legend className="sr-only">Ownership proof</legend>
        <div className="claim-form-heading"><h2>Ownership questions</h2><span>2 required</span></div>
        <label className="report-field">Describe a unique identifying detail <span className="sr-only">(required)</span><textarea name="identifyingDetail" required minLength={10} maxLength={1500} rows={4} value={values.identifyingDetail} onChange={(event) => update("identifyingDetail", event.target.value)} placeholder="A specific mark, engraving, sticker, or detail not visible in the listing…" /></label>
        <label className="report-field">When and where did you last have this item? <span className="sr-only">(required)</span><textarea name="circumstances" required minLength={10} maxLength={1500} rows={4} value={values.circumstances} onChange={(event) => update("circumstances", event.target.value)} placeholder="Include the place, approximate date, and anything only the owner would know." /></label>
        <label className="report-field"><span>Additional proof or context <span className="claim-optional">(optional)</span></span><textarea name="additionalContext" maxLength={1500} rows={3} value={values.additionalContext} onChange={(event) => update("additionalContext", event.target.value)} placeholder="Purchase details or other information that supports your claim." /></label>
        {preview ? <div className="claim-preview-upload"><p>Proof attachment <span>(optional)</span></p><div className="media-dropzone">Photos or videos can be uploaded for a live claim.<p>This example does not collect proof files.</p></div></div> : access?.status === "ready" ? <AttachmentForm files={access.files} selected={selected} onSelect={(id, include) => setSelected((current) => include ? [...new Set([...current, id])] : current.filter((value) => value !== id))} onChanged={reload} onBusyChange={setUploading} disabled={pending} label="Proof photos & video" /> : <p className="report-hint" role="status">{!access ? "Checking proof uploads…" : access.status === "unavailable" ? access.message : "Sign in with a verified account to add proof files."}</p>}
        <label className="claim-confirmation"><input name="confirmed" type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm these details are accurate and I am the rightful owner of this item.</span></label>
        <div className="claim-privacy"><strong>Your proof stays private.</strong><p>Only you and authorized staff may access your answers and proof. The finder does not receive your evidence. Staff review every claim; a match does not prove ownership.</p></div>
        <button type="submit" className="button button-yellow claim-submit" disabled={uploading}>{pending ? "Submitting…" : uploading ? "Uploading proof…" : preview ? "Preview claim submission" : "Submit claim for review"}<span aria-hidden="true">↗</span></button>
      </fieldset>
      {result.message && <p className={result.success ? "claim-success" : "report-error"} role={result.success ? "status" : "alert"}>{result.message}</p>}
    </form>
  );
}
