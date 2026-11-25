import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getReportService } from "@/lib/reports/runtime";

async function Content({ params, searchParams }: PageProps<"/lost/[id]/responses">) {
  const { id } = await params;
  const { response } = await searchParams;
  if (Array.isArray(response)) notFound();
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=" + encodeURIComponent(`/lost/${id}/responses`));
  const post = await (await getReportService()).responses(session.user, id, response);
  if (!post) notFound();
  return <main className="discover-main">
    <Link href="/discover">Back to Discover</Link>
    <header className="discover-heading"><div><h1>{post.title}</h1><p>Lost item status: {post.lifecycle}</p></div></header>
    {response && <Link href={`/lost/${id}/responses`}>View all finder responses</Link>}
    {post.rows.length ? post.rows.map(row => <article id={`response-${row.id}`} key={row.id} className="my-post">
      <h2>Found at {row.location}</h2><time dateTime={row.date}>{row.date}</time>
      <p>Found item status: {row.lifecycle}</p>
      <p className="my-post-description">{row.description}</p>
      {row.media.map((media, i) => <p key={media}><a href={`/api/case-media/published/${row.id}/${media}`}>View attachment {i + 1}</a></p>)}
      {row.canClaim && <Link className="button button-yellow" href={`/claims/${row.id}`}>Claim / verify ownership</Link>}
    </article>) : <p>{response ? "This finder response is unavailable." : "No reviewed finder responses yet."}</p>}
  </main>;
}

export default function FinderResponses(props: PageProps<"/lost/[id]/responses">) {
  return <Suspense fallback={<p role="status">Loading finder responses...</p>}><Content {...props} /></Suspense>;
}
