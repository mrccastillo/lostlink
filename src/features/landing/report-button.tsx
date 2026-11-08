"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "@/components/icons";

type ReportButtonProps = { children?: ReactNode; className?: string };

export function ReportButton({
  children = "Post an item",
  className = "button button-yellow",
}: ReportButtonProps) {
  return (
    <button type="button" className={className} onClick={(event) => {
      const url = new URL(window.location.href);
      url.searchParams.set("compose", "1");
      window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
      event.currentTarget.closest("details")?.removeAttribute("open");
    }} aria-haspopup="dialog">
      {children}
      <ArrowUpRight />
    </button>
  );
}
