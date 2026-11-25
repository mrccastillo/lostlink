"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CloseIcon, MenuIcon } from "@/components/icons";
import { ReportLoginLink } from "@/features/landing/report-login-link";

const links = [
  { href: "#board", label: "The board" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#questions", label: "Good questions" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="site-header page-gutter">
      <a href="#top" className="wordmark" aria-label="LostLink home">
        <span className="brand-mark">
          <ArrowUpRight />
        </span>
        lostlink
      </a>
      <nav
        id="main-navigation"
        className={`main-navigation${open ? " is-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link href="/discover" onNavigate={() => setOpen(false)}>Discover</Link>
        {links.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <ReportLoginLink className="button button-yellow header-cta" />
        <button
          ref={menuRef}
          className="icon-button mobile-menu"
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
    </header>
  );
}
