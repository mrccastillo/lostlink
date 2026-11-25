"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { decideCase } from "@/features/admin/decision-actions";

const labels = {
  publish: "Publish report", hide: "Hide report", approve: "Approve and reserve",
  reject: "Reject claim", handoff: "Record physical handoff", cancel: "Cancel reservation",
};
export type CaseAction = keyof typeof labels;
type Props = {
  actions: CaseAction[]; entityId: string; expected: string; title: string;
  claimant?: string; originalTitle?: string; media: string[];
};
export function DecisionForm({ actions, entityId, expected, title, claimant, originalTitle, media }: Props) {
  const router = useRouter();
  const [selected, select] = useState<CaseAction | null>(null);
  const [reason, setReason] = useState("");
  const [linked, setLinked] = useState("");
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const [result, submit, pending] = useActionState(async (previous: { ok: boolean; message: string }, form: FormData) => {
    const payload = JSON.stringify(Array.from(form.entries()));
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    form.set("requestId", attempt.current.id);
    try {
      const response = await decideCase(previous, form);
      if (response.ok) { select(null); setReason(""); setLinked(""); attempt.current = null; }
      router.refresh();
      return response;
    } catch {
      router.refresh();
      return { ok: false, message: "The save could not be confirmed. Check the current status and retry if needed." };
    }
  }, { ok: false, message: "" });
  const action = selected && actions.includes(selected) ? selected : null;
  const reportDecision = !claimant;
  const form = (
      <form action={submit} className="decision-form">
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="expected" value={expected} />
        {reportDecision ? <input type="hidden" name="action" value={action ?? ""} /> : <fieldset disabled={pending}><legend>Choose a decision</legend>
          {actions.map(value => <label key={value}><input type="radio" required name="action" value={value}
            checked={action === value} onChange={() => select(value)} /> {labels[value]}</label>)}
        </fieldset>}
        {action && <fieldset key={action} disabled={pending}><legend className={reportDecision ? "sr-only" : undefined}>Confirm {labels[action].toLowerCase()}</legend>
          <p><strong>{title}</strong>{claimant && <> · Claimant {claimant}</>}</p>
          {action === "publish" && <p>
            {media.length ? `Publishing makes this report and ${media.length === 1 ? "its attachment" : "all " + media.length + " attachments"} visible to members.` : "Publishing makes this report visible to members."}
            {" "}Check for contact details and private identifiers before confirming.
          </p>}
          <label>Decision reason{(action === "publish" || action === "handoff") && " (optional)"}
            <textarea name="reason" maxLength={1500} required={action !== "publish" && action !== "handoff"} value={reason} onChange={e => setReason(e.target.value)} />
          </label>
          {action === "handoff" && <>
            {originalTitle ? <p>Confirming pickup also marks the original lost post, <strong>{originalTitle}</strong>, as returned.</p> : <label>Confirmed linked lost report ID (optional)<input type="text" name="linkedLostId" value={linked} onChange={e => setLinked(e.target.value.trim())} /></label>}
            {linked && <label><input key={linked} type="checkbox" name="linkedConfirmed" value="yes" required /> I confirmed this lost report refers to the returned item.</label>}
            <label><input type="checkbox" name="handoffConfirmed" value="yes" required /> I confirmed the physical handoff to claimant {claimant}.</label>
          </>}
          <button className="button button-yellow" type="submit">{pending ? "Saving…" : "Confirm " + labels[action].toLowerCase()}</button>
        </fieldset>}
      </form>
  );
  if (reportDecision) return <div className="report-controls">
    {actions.map(value => <button type="button" key={value} data-decision={value} disabled={pending}
      className={value === "publish" ? "button button-yellow" : "button report-secondary"}
      aria-haspopup="dialog" onClick={() => { setReason(""); select(value); }}>{labels[value]}</button>)}
    {result.message && !action && <p role="status">{result.message}</p>}
    <Dialog open={!!action} onClose={() => select(null)} title={action ? labels[action] : "Report decision"} className="report-decision-dialog">
      {form}
      {!result.ok && result.message && <p role="alert">{result.message}</p>}
    </Dialog>
  </div>;
  return <section className="case-section" aria-labelledby="case-decision">
    <h2 id="case-decision">Staff decision</h2>
    {result.message && <p role="status">{result.message}</p>}
    {actions.length ? form : <p>No decisions are available in the current state.</p>}
  </section>;
}
