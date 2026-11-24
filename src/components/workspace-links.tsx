"use client";

import Link from "next/link";
import { useNavigationPathname } from "@/components/navigation-pathname";
import { useRef } from "react";
import { SearchIcon } from "@/components/icons";

export function WorkspaceLinks() {
  const current = `/${useNavigationPathname().split("/")[1]}`;
  const label = useRef<HTMLParagraphElement>(null);
  function closeMenu() { label.current?.closest("details")?.removeAttribute("open"); }
  return (
    <>
      <p ref={label} className="discover-nav-label">Workspace</p>
      <Link onNavigate={closeMenu} href="/discover" className={`discover-nav-link${current === "/discover" ? " is-active" : ""}`} aria-current={current === "/discover" ? "page" : undefined}>
        <SearchIcon /> Discover
      </Link>
      <Link onNavigate={closeMenu} href="/my-posts" className={`discover-nav-link${current === "/my-posts" ? " is-active" : ""}`} aria-current={current === "/my-posts" ? "page" : undefined}><span aria-hidden="true">▤</span> My posts</Link>
      <Link onNavigate={closeMenu} href="/claims" className={`discover-nav-link${current === "/claims" ? " is-active" : ""}`} aria-current={current === "/claims" ? "page" : undefined}><span aria-hidden="true">✓</span> My claims</Link>
    </>
  );
}
