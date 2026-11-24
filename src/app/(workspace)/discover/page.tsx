import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";
import { ArrowUpRight, SearchIcon } from "@/components/icons";
import { listPublished, type Query } from "@/features/discover/listings";
import { REPORT_CATEGORIES } from "@/features/reports/policy";
import { ItemCard } from "@/features/discover/item-card";
import { getCurrentSession } from "@/lib/auth/session";
import { POST_ITEM_LOGIN_PATH, POST_MODAL_PATH } from "@/lib/auth/policy";

export const metadata: Metadata = {
  title: "Discover items — LostLink",
  description: "Explore published lost and found listings, and search by item, category, or location.",
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Query> }) {
  const session = await getCurrentSession();
  if (!session?.user.emailVerified) {
    const composing = (await searchParams).compose === "1";
    if (!session) redirect(composing ? POST_ITEM_LOGIN_PATH : "/login");
    redirect(`/verify-email?next=${encodeURIComponent(composing ? POST_MODAL_PATH : "/discover")}`);
  }
  const { items, filters, page, pages, counts, type, locations } = await listPublished(await searchParams);
  const { q, category, location, date, sort } = filters;
  function listingLink(nextType: string, nextPage = 1) {
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
        <nav className="discover-types" aria-label="Filter by report type">
          {([ ["all", "All items"], ["found", "Found"], ["lost", "Lost"] ] as const).map(([value, label]) => (
            <Link key={value} href={listingLink(value)} aria-current={type === value ? "page" : undefined} scroll={false}>
              {label}<span>{counts[value]}</span>
            </Link>
          ))}
        </nav>
        <p role="status">{counts[type]} {counts[type] === 1 ? "item" : "items"}{q ? ` for “${q}”` : " to explore"}</p>
      </div>
      {items.length ? <div className="discover-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : (
        <div className="discover-empty"><SearchIcon /><h2>No items found</h2><p>Try another keyword or widen your filters.</p><Link href="/discover" className="button button-yellow">Clear search & filters <ArrowUpRight /></Link></div>
      )}
      {pages > 1 && <nav className="discover-pagination" aria-label="Listing pages">
        {page > 1 && <Link href={listingLink(type, page - 1)}>Previous</Link>}
        <span>Page {page} of {pages}</span>
        {page < pages && <Link href={listingLink(type, page + 1)}>Next</Link>}
      </nav>}
    </>
  );
}
