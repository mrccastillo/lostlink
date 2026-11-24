import Link from "next/link";
import { queueDefinition, readCase } from "@/features/admin/cases";
import { DecisionForm, type CaseAction } from "@/features/admin/decision-form";
import { CaseTime, pageLink, queryValue } from "../case-navigation";

function Attachments({ kind, id, media, approved }: {
  kind: "report" | "claim"; id: string; media: string[]; approved?: string[];
}) {
  if (!media.length) return <p>No attachments.</p>;
  return <ul className="case-media">{media.map((file, index) =>
    <li key={file}><a href={`/api/case-media/${kind}/${id}/${file}`}>View {kind === "claim" ? "evidence" : "attachment"} {index + 1}</a>
      {approved?.includes(file) && " · Approved for members"}</li>)}</ul>;
}

type CaseDetails = Awaited<ReturnType<typeof readCase>>;
function availableActions({ claim, report }: CaseDetails, pickup: boolean): CaseAction[] {
  if (!claim) {
    if (report.moderation === "pending") return ["publish", "hide"];
    return report.moderation === "published" ? ["hide"] : [];
  }
  if (pickup) return claim.status === "approved" && report.lifecycle === "reserved"
    && (!report.reservedClaimId || report.reservedClaimId === claim._id) ? ["handoff", "cancel"] : [];
  if (claim.status !== "pending") return [];
  return report.lifecycle === "open" && report.moderation === "published" ? ["approve", "reject"] : ["reject"];
}

export default async function CasePage({ params, searchParams }: PageProps<"/admin/[queue]/[id]">) {
  const { queue: raw, id } = await params;
  const queue = queueDefinition(raw);
  const query = await searchParams;
  const historyCursor = queryValue(query.history);
  const claimsCursor = queryValue(query.competing);
  const details = await readCase(queue.key, id, historyCursor, claimsCursor);
  const { report, claim, history, related } = details;
  const base = "/admin/" + queue.key + "/" + id;
  const actions = availableActions(details, queue.key === "pickups");
  return <>
    <Link href={pageLink("/admin/" + queue.key, { status: queue.key === "pickups" ? undefined : claim?.status ?? report.moderation })}>{queue.label}</Link>
    <h1>{report.title}</h1>
    <p className="case-status">Report {report.moderation} · Item {report.lifecycle}{claim && " · Claim " + claim.status}</p>
    <section className="case-section">
      <h2>{claim ? "Found report" : "Member-visible preview"}</h2>
      <dl className="case-facts">{Object.entries({ Type: report.type, Category: report.category, Location: report.location, "Date of occurrence": report.occurredOn }).map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="case-text">{report.description}</p>
      {claim ? <Link href={"/admin/reports/" + report._id}>Open report and moderation history</Link> :
        <><h3>Report attachments for review</h3><Attachments kind="report" id={id} media={report.attachments} approved={report.approvedMedia} /></>}
    </section>
    {report.moderationReason && <p>Moderation reason · {report.moderationReason}</p>}
    {claim && <section className="case-section">
      <h2>Ownership evidence</h2>
      <p>Claim #{claim._id.slice(0, 8).toUpperCase()} · Claimant {claim.claimantId}</p>
      {queue.key === "pickups" && claim.status === "approved" && <p>At collection, match this reference to the approved claim in the member’s signed-in My claims page.</p>}
      <dl className="case-answers">
        <dt>Identifying detail</dt><dd>{claim.identifyingDetail}</dd>
        <dt>Last possession</dt><dd>{claim.circumstances}</dd>
        {claim.additionalContext && <><dt>Additional context</dt><dd>{claim.additionalContext}</dd></>}
      </dl>
      <h3>Private attachments</h3><Attachments kind="claim" id={id} media={claim.attachments} />
      {claim.decisionReason && <p>Decision reason · {claim.decisionReason}</p>}
      {queue.key === "claims" && claim.status === "approved" && <Link href={"/admin/pickups/" + id}>Open reserved pickup</Link>}
    </section>}
    {report.type === "found" && <section className="case-section" id="competing">
      <h2>{claim ? "Competing claims" : "Claims on this report"}</h2>
      {related.items.length ? <ul className="case-list">{related.items.map(c => <li key={c._id}>
        <Link href={"/admin/claims/" + c._id}>Claimant {c.claimantId} · {c.status}</Link><CaseTime date={c.createdAt} /></li>)}</ul> : <p>No {claim ? "competing " : ""}claims on this page.</p>}
      <nav className="case-pages" aria-label="Related claim pages">
        {claimsCursor && <Link href={pageLink(base, { history: historyCursor }) + "#competing"}>First claims</Link>}
        {related.next && <Link href={pageLink(base, { history: historyCursor, competing: related.next }) + "#competing"}>More claims</Link>}
      </nav>
    </section>}
    {claim?.status === "pending" && queue.key === "claims" && !actions.includes("approve") &&
      <p>Approval requires a published, open item. This item is {report.moderation} and {report.lifecycle}.</p>}
    <DecisionForm key={id} actions={actions} entityId={id} expected={claim?.status ?? report.moderation} title={report.title} claimant={claim?.claimantId} media={claim ? [] : report.attachments} />
    <section className="case-section" id="history"><h2>Case history</h2>
      {history.items.length ? <ol className="case-history">{history.items.map(event =>
        <li key={event._id.toString()}><strong>{event.action.replace(".", " ")}</strong> · <CaseTime date={event.createdAt} />
          <p>Actor {event.actorId}</p>
          {event.from && event.to && <p>{event.from} → {event.to}</p>}
          {event.lifecycleFrom && <p>Item {event.lifecycleFrom} → {event.lifecycleTo}</p>}
          <p>Report {event.reportId ?? report._id}{(event.claimId || claim) && " · Claim " + (event.claimId ?? claim?._id)}</p>
          {event.linkedLostId && <Link href={"/admin/reports/" + event.linkedLostId}>Linked lost report {event.linkedLostId}</Link>}
        </li>)}</ol> : <p>No events recorded on this page.</p>}
      <nav className="case-pages" aria-label="History pages">
        {historyCursor && <Link href={pageLink(base, { competing: claimsCursor }) + "#history"}>First events</Link>}
        {history.next && <Link href={pageLink(base, { history: history.next, competing: claimsCursor }) + "#history"}>Next events</Link>}
      </nav>
    </section>
  </>;
}

