import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AdminIcon } from "@/components/admin-icon";
import { ArrowUpRight } from "@/components/icons";
import type { AdminQueue } from "@/features/admin/navigation";
import { queueDefinition, queueStates, readQueue } from "@/features/admin/cases";
import { CaseTime, pageLink, queryValue } from "./case-navigation";

const queueDescriptions = {
  reports: "Review community reports and choose what appears on Discover.",
  claims: "Review ownership evidence and record a decision for each claim.",
  pickups: "Confirm collection and record the physical handoff of reserved items.",
};
const emptyDescriptions = {
  reports: "New reports will appear here when members submit them for review.",
  claims: "Ownership requests will appear here when members submit a claim.",
  pickups: "Approved claims appear here until the physical handoff is recorded.",
};

async function QueueContents({ queue, searchParams }: {
  queue: AdminQueue;
  searchParams: PageProps<"/admin/[queue]">["searchParams"];
}) {
  const query = await searchParams;
  const states = queueStates[queue];
  const state = queryValue(query.status) ?? states[0];
  const cursor = queryValue(query.cursor);
  const first = "/admin/" + queue;
  const result = await readQueue(queue, state, cursor);
  const emptyDescription = cursor
    ? "There are no more records on this page. Return to the first page to see the latest."
    : state === "pending" || queue === "pickups"
      ? emptyDescriptions[queue]
      : `Records marked ${state} will appear in this view.`;
  return <>
    {states.length > 1 && <nav className="case-tabs" aria-label="Filter by status">{states.map(status =>
      <Link key={status} aria-current={status === state ? "page" : undefined} href={pageLink(first, { status })}>{status}</Link>)}</nav>}
    {result.items.length ? <ul className={queue === "reports" ? "report-queue-grid" : "case-list"}>{result.items.map(row => row.kind === "report" ?
      <li className="report-tile" key={row.id}>
        <div className="report-tile-cover">
          {row.cover ? <Image src={row.cover} alt="" fill unoptimized sizes="(max-width: 700px) 100vw, 32vw" /> : <span className="report-no-photo"><AdminIcon name="reports" />No photo</span>}
          <span className={`report-type-tag ${row.detail}`}>{row.detail}</span>
        </div>
        <div className="report-tile-copy">
          <p className="eyebrow">{row.isFinderResponse && "Finder response / "}{row.category}</p>
          <h2><Link href={first + "/" + row.id}>{row.title}</Link><ArrowUpRight /></h2>
          <p>{row.location}</p>
          <time dateTime={row.occurredOn}>{row.detail === "lost" ? "Lost" : "Found"} on {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(row.occurredOn))}</time>
        </div>
      </li> :
      <li key={row.id}>
        <div className="case-row-icon"><AdminIcon name={queue} /></div>
        <div className="case-row-copy"><Link href={first + "/" + row.id}>{row.title}</Link><p>{row.detail}</p></div>
        <CaseTime date={row.date} />
        <ArrowUpRight />
      </li>)}</ul>
      : <div className="discover-empty case-empty">
          <AdminIcon name={queue} />
          <h2>{queue === "pickups" ? "No pickups waiting" : `No ${state} ${queue}`}</h2>
          <p>{emptyDescription}</p>
        </div>}
    <nav aria-label="Queue pages" className="case-pages">
      {cursor && <Link href={pageLink(first, { status: state })}>First page</Link>}
      {result.next && <Link href={pageLink(first, { status: state, cursor: result.next })}>Next page</Link>}
    </nav>
  </>;
}

export default async function QueuePage({ params, searchParams }: PageProps<"/admin/[queue]">) {
  const queue = queueDefinition((await params).queue);
  return <>
    <header className="discover-heading">
      <div>
        <h1>{queue.label}</h1>
        <p>{queueDescriptions[queue.key]}</p>
      </div>
    </header>
    <Suspense fallback={<p role="status">Loading cases…</p>}>
      <QueueContents queue={queue.key} searchParams={searchParams} />
    </Suspense>
  </>;
}
