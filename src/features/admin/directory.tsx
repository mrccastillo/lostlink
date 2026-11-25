import { Suspense } from "react";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/policy";
import { getDomainDatabase } from "@/lib/mongodb";
import { directoryPages, type DirectoryPage } from "./navigation";
import { CreateAdminForm } from "./create-admin-form";

type Query = Promise<Record<string, string | string[] | undefined>>;
const dates = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" });

async function DirectoryContent({ section, query }: { section: DirectoryPage; query: Query }) {
  const session = await getCurrentSession();
  const path = "/admin/" + section;
  if (!session) redirect("/login?next=" + encodeURIComponent(path));
  if (!canAccessAdmin(session.user)) notFound();
  const { before } = await query;
  if (before !== undefined && (typeof before !== "string" || !ObjectId.isValid(before))) notFound();
  const cursor = before ? { _id: { $lt: new ObjectId(before) } } : {};
  const { db } = await getDomainDatabase();
  const audit = section === "audit";
  const collection = audit ? "audit_events" : "user";
  const filter = audit ? { organization: "community" } : section === "admins" ? { role: "admin" } : {};
  const projection = audit ? { action: 1, actorId: 1, entityId: 1, createdAt: 1 } : { name: 1, email: 1, role: 1, emailVerified: 1 };
  const rows = await db.collection(collection).find({ ...filter, ...cursor }, { projection }).sort({ _id: -1 }).limit(31).toArray();
  const visible = rows.slice(0, 30);
  const columns = audit ? ["Event", "Actor ID", "Record ID", "Time (SGT)"] : ["Name", "Email", "Role", "Email verified"];
  return <main id="admin-main" className="discover-main admin-main staff-directory">
    <header className="discover-heading"><h1>{directoryPages.find(page => page.key === section)?.label}</h1></header>
    {section === "admins" && <CreateAdminForm />}
    {visible.length ? <div className="staff-table"><table><thead><tr>{columns.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(row => <tr key={String(row._id)}>{(audit
        ? [row.action, row.actorId, row.entityId ?? "?", dates.format(row.createdAt)]
        : [row.name, row.email, row.role ?? "member", row.emailVerified ? "Yes" : "No"]).map((value, i) => <td key={columns[i]}>{value}</td>)}</tr>)}</tbody></table></div>
      : <p>No {audit ? "audit events" : "accounts"} on this page.</p>}
    <nav aria-label="Directory pages">{before && <Link href={path}>First page</Link>} {rows.length > 30 && <Link href={path + "?before=" + visible[29]._id}>Next page</Link>}</nav>
  </main>;
}

export function Directory(props: { section: DirectoryPage; query: Query }) {
  return <Suspense fallback={<p role="status">Loading?</p>}><DirectoryContent {...props} /></Suspense>;
}
