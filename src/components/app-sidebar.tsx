import { Suspense } from "react";
import { canAccessAdmin } from "@/lib/auth/policy";
import { getCurrentSession } from "@/lib/auth/session";
import Link from "next/link";
import { AdminNavigationLinks } from "@/components/admin-navigation-links";
import { WorkspaceLinks } from "@/components/workspace-links";
import { ArrowUpRight } from "@/components/icons";
import { SignOutButton } from "@/features/auth/sign-out-button";

async function AdminNavigation() {
  const session = await getCurrentSession();
  if (!canAccessAdmin(session?.user)) return null;
  return <AdminNavigationLinks />;
}

function Navigation() {
  return (
    <>
      <WorkspaceLinks />
      <Suspense fallback={null}><AdminNavigation /></Suspense>
      <div className="discover-sign-out"><SignOutButton /></div>
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="discover-sidebar">
      <Link href="/discover" className="wordmark discover-wordmark" aria-label="LostLink Discover">
        <span className="brand-mark"><ArrowUpRight /></span> lostlink
      </Link>
      <nav className="discover-desktop-nav" aria-label="Workspace navigation"><Navigation /></nav>
      <details className="discover-mobile-nav">
        <summary>Navigation <span aria-hidden="true">＋</span></summary>
        <nav aria-label="Mobile workspace navigation"><Navigation /></nav>
      </details>
    </aside>
  );
}
