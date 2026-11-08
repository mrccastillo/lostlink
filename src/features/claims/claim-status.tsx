import type { ClaimSummary } from "@/lib/claims/service";

export function ClaimStatus({ claim, preview = false }: { claim: ClaimSummary | null; preview?: boolean }) {
  const step = !claim ? 1 : claim.status === "pending" ? 2 : 3;
  return (
    <section className="claim-progress" aria-labelledby="claim-status-title">
      <div className="claim-progress-heading"><h2 id="claim-status-title">{!claim ? "Start your claim" : `Claim ${claim.status}`}</h2><span>{preview ? "EXAMPLE ITEM" : claim ? `#${claim.id.slice(0, 8).toUpperCase()}` : "PRIVATE VERIFICATION"}</span></div>
      <ol className="claim-steps">{["Add proof", "Staff review", "Decision"].map((label, index) => <li key={label} className={index + 1 <= step ? "is-current" : ""} aria-current={index + 1 === step ? "step" : undefined}><span>{index + 1 < step ? "✓" : index + 1}</span><p>{label}</p></li>)}</ol>
      <p className="claim-progress-note">{!claim ? "Share identifying details so staff can review your ownership." : claim.status === "pending" ? "Your proof is awaiting staff review. Submission does not reserve the item." : claim.status === "approved" ? "Your claim is approved. Only a recorded physical handoff completes the return." : `Your claim is ${claim.status}.`}</p>
    </section>
  );
}
