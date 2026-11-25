import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";
import { ArrowUpRight, SearchIcon } from "@/components/icons";
import { attachListingMedia, listPublished, type Query } from "@/features/discover/listings";
import { listMatches } from "@/features/discover/match-service";
import { REPORT_CATEGORIES } from "@/features/reports/policy";
import { ItemCard } from "@/features/discover/item-card";
import { ReportButton } from "@/features/landing/report-button";
import { getCurrentSession } from "@/lib/auth/session";
import { DISCOVER_MATCHES_PATH, POST_ITEM_LOGIN_PATH, POST_MODAL_PATH } from "@/lib/auth/policy";
import { getDomainDatabase } from "@/lib/mongodb";

export const metadata: Metadata = {
  title: "Discover items — LostLink",
  description: "Explore published lost and found listings, and search by item, category, or location.",
};

const views = [["all", "All items"], ["found", "Found"], ["lost", "Lost"], ["matches", "My matches"]] as const;
type View = (typeof views)[number][0];
type Counts = Record<Exclude<View, "matches">, number>;
const matchDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function DiscoverTabs({ active, hrefFor, counts }: { active: View; hrefFor: (view: View) => string; counts?: Counts }) {
  return <nav className="discover-types" aria-label="Discover views">
    {views.map(([view, label]) => (
      <Link key={view} href={hrefFor(view)} aria-current={active === view ? "page" : undefined} scroll={view === "matches" || active === "matches"}>
        {label}{counts && view !== "matches" && <span>{counts[view]}</span>}
      </Link>
    ))}
  </nav>;
}

function DiscoverPagination({ page, pages, link, label }: { page: number; pages: number; link: (page: number) => string; label: string }) {
  if (pages <= 1) return null;
  return <nav className="discover-pagination" aria-label={label}>
    {page > 1 && <Link href={link(page - 1)}>Previous</Link>}
    <span>Page {page} of {pages}</span>
    {page < pages && <Link href={link(page + 1)}>Next</Link>}
  </nav>;
}

async function MyMatches({ actor, requestedPage }: { actor: { id: string; emailVerified: boolean }; requestedPage: number }) {
  const { db } = await getDomainDatabase();
  const { groups, page, pages } = await listMatches(db, actor, requestedPage);
  const rows = new Map(groups.flatMap(group => group.matches.map(({ item }) => [item._id, item] as const)));
  const items = new Map((await attachListingMedia(db, [...rows.values()])).map(item => [item.id, item]));

  return <>
    <div className="discover-results-bar">
      <DiscoverTabs active="matches" hrefFor={view => view === "matches" ? DISCOVER_MATCHES_PATH : `/discover?type=${view}`} />
    </div>
    {groups.length ? <>
      <p className="discover-match-note">Compare possible matches with your lost reports. Staff review ownership claims.</p>
      {groups.map(group => (
        <section className="discover-match-group" key={group.id} aria-labelledby={`lost-${group.id}`}>
          <header>
            <h2 id={`lost-${group.id}`}>{group.title}</h2>
            <p className="discover-item-date">Lost on <time dateTime={group.occurredOn}>{matchDate.format(new Date(`${group.occurredOn}T00:00:00Z`))}</time></p>
          </header>
          {group.matches.length ? <div className="discover-grid">
            {group.matches.map(({ item: row, reasons }) => {
              const item = items.get(row._id);
              return item && <div key={item.id} className="discover-match">
                <ItemCard item={item} />
                <ul className="discover-match-reasons" aria-label="Why this might match">
                  {reasons.map(reason => <li key={reason}>{reason}</li>)}
                </ul>
              </div>;
            })}
          </div> : <p className="discover-match-note">No possible matches yet. <Link href="/discover?type=found">Browse found items</Link></p>}
        </section>
      ))}
    </> : <div className="discover-empty">
      <SearchIcon /><h2>You have no open lost reports</h2>
      <p>Report an item you lost to see possible matches here.</p>
      <ReportButton>Report a lost item</ReportButton>
    </div>}
    <DiscoverPagination page={page} pages={pages} link={next => `${DISCOVER_MATCHES_PATH}&page=${next}`} label="Lost reports pages" />
  </>;
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const session = await getCurrentSession();
  if (!session?.user.emailVerified) {
    const returnTo = params.type === "matches" ? DISCOVER_MATCHES_PATH : "/discover";
    const composing = params.compose === "1";
    if (!session) redirect(composing ? POST_ITEM_LOGIN_PATH : returnTo === "/discover" ? "/login" : `/login?next=${encodeURIComponent(returnTo)}`);
    redirect(`/verify-email?next=${encodeURIComponent(composing ? POST_MODAL_PATH : returnTo)}`);
  }
  if (params.type === "matches") {
    return <MyMatches actor={session.user} requestedPage={typeof params.page === "string" ? Number(params.page) : 1} />;
  }
  const { items, filters, page, pages, counts, type, locations } = await listPublished(params);
  const { q, category, location, date, sort } = filters;
  function listingLink(nextType: View, nextPage = 1) {
    if (nextType === "matches") return DISCOVER_MATCHES_PATH;
    const query = new URLSearchParams({ ...filters, type: nextType, page: String(nextPage) });
    return `/discover?${query}`;
  }

  return (
    <>
      <Form action="/discover" className="discover-filters" key={`${q}-${category}-${location}-${sort}-${type}-${date}`}>
        <input type="hidden" name="type" value={type} />
        <div className="discover-search-row">
          <label className="discover-search"><SearchIcon /><span className="sr-only">Search items</span><input name="q" type="search" placeholder="Search for an item, place, or detail…" defaultValue={q} maxLength={120} /></label>
          <button className="button button-dark" type="submit">Search <ArrowUpRight /></button>
        </div>
        <div className="discover-filter-row">
          <label>Category<select name="category" defaultValue={category}><option value="">All categories</option>{REPORT_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Location<input list="discover-locations" name="location" defaultValue={location} maxLength={120} placeholder="All locations" /><datalist id="discover-locations">{locations.map(value => <option key={value} value={value} />)}</datalist></label>
          <label>Occurrence date<input type="date" name="date" defaultValue={date} /></label>
          <label>Sort by<select name="sort" defaultValue={sort}><option value="az">Name: A–Z</option><option value="za">Name: Z–A</option></select></label>
          <button className="discover-apply" type="submit">Apply filters</button>
          <Link href="/discover" className="discover-reset">Reset</Link>
        </div>
      </Form>
      <div className="discover-results-bar">
        <DiscoverTabs active={type} hrefFor={listingLink} counts={counts} />
        <p role="status">{counts[type]} {counts[type] === 1 ? "item" : "items"}{q ? ` for “${q}”` : " to explore"}</p>
      </div>
      {items.length ? <div className="discover-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : (
        <div className="discover-empty"><SearchIcon /><h2>No items found</h2><p>Try another keyword or widen your filters.</p><Link href="/discover" className="button button-yellow">Clear search & filters <ArrowUpRight /></Link></div>
      )}
      <DiscoverPagination page={page} pages={pages} link={next => listingLink(type, next)} label="Listing pages" />
    </>
  );
}
