import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { ArrowUpRight, SearchIcon } from "@/components/icons";
import { sampleReports } from "@/features/landing/content";
import { ItemCard } from "@/features/discover/item-card";
import { getCurrentSession } from "@/lib/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ReportButton } from "@/features/landing/report-button";
import "./discover.css";

export const metadata: Metadata = {
  title: "Discover items — LostLink",
  description: "Explore example lost and found listings, and search by item, category, or location.",
};

type Query = Record<string, string | string[] | undefined>;
async function AccountNavigation() {
  const session = await getCurrentSession();
  return session ? <SignOutButton /> : <Link href="/login">Sign in <ArrowUpRight /></Link>;
}
const categories = [...new Set(sampleReports.map((item) => item.category))];
const locations = [...new Set(sampleReports.map((item) => item.location))];

async function Listings({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const type = params.type === "lost" || params.type === "found" ? params.type : "all";
  const category = categories.find((value) => value === params.category) ?? "";
  const location = locations.find((value) => value === params.location) ?? "";
  const sort = params.sort === "za" ? "za" : "az";
  const matches = sampleReports.filter((item) =>
    (!category || item.category === category) && (!location || item.location === location) &&
    `${item.name} ${item.category} ${item.location} ${item.description}`.toLowerCase().includes(q.toLowerCase()),
  );
  const items = matches.filter((item) => type === "all" || item.status === type)
    .sort((a, b) => (sort === "az" ? 1 : -1) * a.name.localeCompare(b.name));
  function typeLink(value: string) {
    const query = new URLSearchParams({ q, category, location, sort, type: value });
    return `/discover?${query}`;
  }

  return (
    <>
      <form action="/discover" method="get" className="discover-filters" key={`${q}-${category}-${location}-${sort}-${type}`}>
        <input type="hidden" name="type" value={type} />
        <div className="discover-search-row">
          <label className="discover-search"><SearchIcon /><span className="sr-only">Search items</span><input name="q" type="search" placeholder="Search for an item, place, or detail…" defaultValue={q} maxLength={120} /></label>
          <button className="button button-dark" type="submit">Search <ArrowUpRight /></button>
        </div>
        <div className="discover-filter-row">
          <label>Category<select name="category" defaultValue={category}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Location<select name="location" defaultValue={location}><option value="">All locations</option>{locations.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Sort by<select name="sort" defaultValue={sort}><option value="az">Name: A–Z</option><option value="za">Name: Z–A</option></select></label>
          <button className="discover-apply" type="submit">Apply filters</button>
          <Link href="/discover" className="discover-reset">Reset</Link>
        </div>
      </form>
      <div className="discover-results-bar">
        <nav className="discover-types" aria-label="Filter by report type">
          {([ ["all", "All items"], ["found", "Found"], ["lost", "Lost"] ] as const).map(([value, label]) => (
            <Link key={value} href={typeLink(value)} aria-current={type === value ? "page" : undefined} scroll={false}>
              {label}<span>{matches.filter((item) => value === "all" || item.status === value).length}</span>
            </Link>
          ))}
        </nav>
        <p role="status">{items.length} {items.length === 1 ? "item" : "items"}{q ? ` for “${q}”` : " to explore"}</p>
      </div>
      {items.length ? <div className="discover-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : (
        <div className="discover-empty"><SearchIcon /><h2>No items found</h2><p>Try another keyword or widen your filters.</p><Link href="/discover" className="button button-yellow">Clear search & filters <ArrowUpRight /></Link></div>
      )}
      <p className="discover-end">You’re all caught up with these example listings.</p>
    </>
  );
}

export default function DiscoverPage({ searchParams }: { searchParams: Promise<Query> }) {
  return (
    <div className="discover-shell">
      <a className="skip-link" href="#discover-main">Skip to items</a>
      <AppSidebar />
      <div className="discover-workspace">
        <header className="discover-topbar"><span>THE COMMUNITY BOARD</span><Suspense fallback={<span role="status">Checking account…</span>}><AccountNavigation /></Suspense></header>
        <main id="discover-main" className="discover-main">
          <div className="discover-heading">
            <div>
              <h1>Discover</h1>
              <p>Browse lost and found items in one place.</p>
            </div>
            <ReportButton />
          </div>
          <div className="discover-demo-note"><span className="discover-demo-tag">PREVIEW</span><p>These are example listings. Submitted reports are saved for review.</p></div>
          <Suspense fallback={<p className="discover-loading" role="status">Loading items…</p>}><Listings searchParams={searchParams} /></Suspense>
        </main>
      </div>
    </div>
  );
}
