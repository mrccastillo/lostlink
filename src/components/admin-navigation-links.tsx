"use client";

import Link from "next/link";
import { useNavigationPathname } from "@/components/navigation-pathname";
import { useRef } from "react";
import { AdminIcon } from "@/components/admin-icon";
import { adminQueues } from "@/features/admin/navigation";
import { ADMIN_DASHBOARD_PATH } from "@/lib/auth/policy";

const links = [
  { key: "admin", label: "Dashboard", href: ADMIN_DASHBOARD_PATH },
  ...adminQueues.map(queue => ({ ...queue, href: `${ADMIN_DASHBOARD_PATH}/${queue.key}` })),
] as const;

export function AdminNavigationLinks() {
  const pathname = useNavigationPathname();
  const heading = useRef<HTMLParagraphElement>(null);

  function closeMobileNavigation() {
    heading.current?.closest("details")?.removeAttribute("open");
  }

  return (
    <>
      <p ref={heading} className="discover-nav-label admin-nav-label">Admin tools</p>
      {links.map(({ key, label, href }) => {
        const current = pathname === href || (key !== "admin" && pathname.startsWith(href + "/"));
        return (
          <Link key={key} href={href} prefetch onNavigate={closeMobileNavigation}
            className={`discover-nav-link${current ? " is-active" : ""}`} aria-current={current ? "page" : undefined}>
            <AdminIcon name={key} /> {label}
          </Link>
        );
      })}
    </>
  );
}
