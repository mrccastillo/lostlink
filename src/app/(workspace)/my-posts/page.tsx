import Image from "next/image";
import { AdminIcon } from "@/components/admin-icon";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportButton } from "@/features/landing/report-button";
import { getCurrentSession } from "@/lib/auth/session";
import { getReportService } from "@/lib/reports/runtime";
import { ReportError } from "@/features/reports/policy";

export const metadata: Metadata = { title: "My posts — LostLink", robots: { index: false, follow: false } };
type Query = Record<string, string | string[] | undefined>;
const dates = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Singapore" });
const reviews = { pending: "Awaiting review", published: "Published", hidden: "Hidden" };

export default async function MyPostsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=%2Fmy-posts");
  if (!session.user.emailVerified) redirect("/verify-email?next=%2Fmy-posts");
  const params = await searchParams;
  const type = params.type === "lost" || params.type === "found" ? params.type : undefined;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const service = await getReportService();
  let page;
  try { page = await service.listOwn(session.user, { type, cursor }); }
  catch (error) { if (error instanceof ReportError) return <div className="my-posts-empty"><h2>Invalid page link</h2><p>{error.message}</p><Link href="/my-posts" className="button button-yellow">Back to my posts</Link></div>; throw error; }
  const next = new URLSearchParams();
  if (type) next.set("type", type);
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  return (
    <>
      <nav className="my-posts-tabs" aria-label="Filter your posts">{([ [undefined, "All posts"], ["lost", "Lost"], ["found", "Found"] ] as const).map(([value, label]) => <Link key={label} href={value ? `/my-posts?type=${value}` : "/my-posts"} aria-current={type === value ? "page" : undefined}>{label}</Link>)}</nav>
      <p className="my-posts-note">Only your reports appear here, including those awaiting review.</p>
      {page.items.length ? <div className="my-posts-list">{page.items.map((post) => <article className="my-post" key={post.id}>
        <div className="my-post-cover">
          {post.cover ? <Image src={post.cover} alt={`Photo of ${post.title}`} fill sizes="(max-width: 600px) 72px, 136px" unoptimized /> : <AdminIcon name="reports" aria-label="No photo" />}
        </div>
        <div className="my-post-copy"><div className="my-post-top"><span className="my-post-type">{post.type === "lost" ? "Lost" : "Found"} · {post.category}</span><span className={`my-post-review is-${post.moderation}`}>{reviews[post.moderation]}</span></div>
        <h2>{post.title}</h2>
        <p className="my-post-description">{post.description}</p>
        <p className="my-post-location">{post.location} <span aria-hidden="true">·</span> {post.type === "lost" ? "Lost" : "Found"} on <time dateTime={post.occurredOn}>{dates.format(new Date(`${post.occurredOn}T00:00:00Z`))}</time></p>
        <details><summary>View report details</summary><dl><div><dt>Item status</dt><dd>{post.lifecycle}</dd></div><div><dt>Submitted</dt><dd><time dateTime={post.createdAt}>{dates.format(new Date(post.createdAt))}</time></dd></div><div><dt>Attachments</dt><dd>{post.attachmentCount} saved with this report</dd></div></dl></details>
        {post.type === "lost" && post.moderation === "published" && <Link href={`/lost/${post.id}/responses`}>View finder responses</Link>}
        </div>
      </article>)}</div> : <div className="my-posts-empty"><span aria-hidden="true">▤</span><h2>{type ? `No ${type} posts yet` : "No posts yet"}</h2><p>Reports you submit will appear here with their review status.</p><ReportButton /></div>}
      {(cursor || page.nextCursor) && <nav className="my-posts-pagination" aria-label="Your posts pages"><Link href={type ? `/my-posts?type=${type}` : "/my-posts"}>First page</Link>{page.nextCursor && <Link href={`/my-posts?${next}`}>Older posts →</Link>}</nav>}
    </>
  );
}
