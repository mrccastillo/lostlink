import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./cases.css";

export const metadata: Metadata = { title: "Staff cases — LostLink", robots: { index: false, follow: false } };

export default function QueueLayout({ children }: { children: ReactNode }) {
  return <main id="admin-main" className="admin-main case-main">{children}</main>;
}
