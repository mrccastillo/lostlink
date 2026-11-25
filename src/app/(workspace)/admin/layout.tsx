import type { ReactNode } from "react";
import "./admin.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>
    <header className="discover-topbar"><span>COMMUNITY ADMINISTRATION</span></header>
    {children}
  </>;
}
