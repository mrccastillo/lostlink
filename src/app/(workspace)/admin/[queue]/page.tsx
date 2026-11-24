import Link from "next/link";
import { Suspense } from "react";
import type { AdminQueue } from "@/features/admin/navigation";
import { queueDefinition, queueStates, readQueue } from "@/features/admin/cases";
import { CaseTime, pageLink, queryValue } from "./case-navigation";

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
  return <>
    {states.length > 1 && <nav className="case-tabs" aria-label="Filter by status">{states.map(status =>
      <Link key={status} aria-current={status === state ? "page" : undefined} href={pageLink(first, { status })}>{status}</Link>)}</nav>}
    {result.items.length ? <ul className="case-list">{result.items.map(row =>
      <li key={row.id}><div><Link href={first + "/" + row.id}>{row.title}</Link><p>{row.detail}</p></div><CaseTime date={row.date} /></li>)}</ul>
      : <p className="admin-empty">No {state} {queue} on this page.</p>}
    <nav aria-label="Queue pages" className="case-pages">
      {cursor && <Link href={pageLink(first, { status: state })}>First page</Link>}
      {result.next && <Link href={pageLink(first, { status: state, cursor: result.next })}>Next page</Link>}
    </nav>
  </>;
}

export default async function QueuePage({ params, searchParams }: PageProps<"/admin/[queue]">) {
  const queue = queueDefinition((await params).queue);
  return <>
    <Link href="/admin">Admin dashboard</Link>
    <h1>{queue.label}</h1>
    <Suspense fallback={<p role="status">Loading cases…</p>}>
      <QueueContents queue={queue.key} searchParams={searchParams} />
    </Suspense>
  </>;
}
