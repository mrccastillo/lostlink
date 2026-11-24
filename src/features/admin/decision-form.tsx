"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decideCase } from "@/features/admin/decision-actions";

const labels = {
  publish: "Publish report", hide: "Hide report", approve: "Approve and reserve",
  reject: "Reject claim", handoff: "Record physical handoff", cancel: "Cancel reservation",
};
export type CaseAction = keyof typeof labels;
type Props = {
  actions: CaseAction[]; entityId: string; expected: string; title: string;
  claimant?: string; media: string[];
};
export function DecisionForm({ actions, entityId, expected, title, claimant, media }: Props) {
  const router = useRouter();
  const [selected, select] = useState<CaseAction | null>(null);
  const [reason, setReason] = useState("");
  const [linked, setLinked] = useState("");
  const [approved, setApproved] = useState<string[]>([]);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const [result, submit, pending] = useActionState(async (previous: { ok: boolean; message: string }, form: FormData) => {
    const payload = JSON.stringify(Array.from(form.entries()));
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    form.set("requestId", attempt.current.id);
    try {
      const response = await decideCase(previous, form);
      if (response.ok) { select(null); setReason(""); setLinked(""); setApproved([]); attempt.current = null; }
      router.refresh();
      return response;
    } catch {
      router.refresh();
      return { ok: false, message: "The save could not be confirmed. Check the current status and retry if needed." };
    }
  }, { ok: false, message: "" });
  const action = selected && actions.includes(selected) ? selected : null;
  return <section className="case-section" aria-labelledby="case-decision">
    <h2 id="case-decision">Staff decision</h2>
    {result.message && <p role="status">{result.message}</p>}
    {!actions.length ? <p>No decisions are available in the current state.</p> :
      <form action={submit} className="decision-form">
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="expected" value={expected} />
        <fieldset disabled={pending}><legend>Choose a decision</legend>
          {actions.map(value => <label key={value}><input type="radio" required name="action" value={value}
            checked={action === value} onChange={() => select(value)} /> {labels[value]}</label>)}
        </fieldset>
        {action && <fieldset key={action} disabled={pending}><legend>Confirm {labels[action].toLowerCase()}</legend>
          <p><strong>{title}</strong>{claimant && <> · Claimant {claimant}</>}</p>
          {action === "publish" && <>
            <p>Hide reports with contact details or private identifiers in the member-visible text or selected media. Only selected attachments will be published.</p>
            {media.map((id, i) => <label key={id}><input type="checkbox" name="approvedMedia" value={id} checked={approved.includes(id)}
              onChange={e => setApproved(e.target.checked ? [...approved, id] : approved.filter(value => value !== id))} /> Publish attachment {i + 1}</label>)}
          </>}
          <label>Decision reason{(action === "publish" || action === "handoff") && " (optional)"}
            <textarea name="reason" maxLength={1500} required={action !== "publish" && action !== "handoff"} value={reason} onChange={e => setReason(e.target.value)} />
          </label>
          {action === "handoff" && <>
            <label>Confirmed linked lost report ID (optional)<input type="text" name="linkedLostId" value={linked} onChange={e => setLinked(e.target.value.trim())} /></label>
            {linked && <label><input key={linked} type="checkbox" name="linkedConfirmed" value="yes" required /> I confirmed this lost report refers to the returned item.</label>}
            <label><input type="checkbox" name="handoffConfirmed" value="yes" required /> I confirmed the physical handoff to claimant {claimant}.</label>
          </>}
          <button className="button button-yellow" type="submit">{pending ? "Saving…" : "Confirm " + labels[action].toLowerCase()}</button>
        </fieldset>}
      </form>}
  </section>;
}

