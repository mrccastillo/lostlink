import Link from "next/link";
import { ArrowUpRight, SearchIcon } from "@/components/icons";

function Navigation({ active }: { active: "discover" | "help" | "claims" | "posts" }) {
  return (
    <>
      <p className="discover-nav-label">Workspace</p>
      <Link href="/discover" className={`discover-nav-link${active === "discover" ? " is-active" : ""}`} aria-current={active === "discover" ? "page" : undefined}>
        <SearchIcon /> Discover
      </Link>
      <Link href="/my-posts" className={`discover-nav-link${active === "posts" ? " is-active" : ""}`} aria-current={active === "posts" ? "page" : undefined}><span aria-hidden="true">▤</span> My posts</Link>
      <Link href="/claims" className={`discover-nav-link${active === "claims" ? " is-active" : ""}`} aria-current={active === "claims" ? "page" : undefined}><span aria-hidden="true">✓</span> My claims</Link>
    </>
  );
}

export function AppSidebar({ active = "discover" }: { active?: "discover" | "help" | "claims" | "posts" }) {
  return (
    <aside className="discover-sidebar">
      <Link href="/discover" className="wordmark discover-wordmark" aria-label="LostLink Discover">
        <span className="brand-mark"><ArrowUpRight /></span> lostlink
      </Link>
      <nav className="discover-desktop-nav" aria-label="Workspace navigation"><Navigation active={active} /></nav>
      <details className="discover-mobile-nav">
        <summary>Navigation <span aria-hidden="true">＋</span></summary>
        <nav aria-label="Mobile workspace navigation"><Navigation active={active} /></nav>
      </details>
    </aside>
  );
}
