import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminIcon } from "@/components/admin-icon";
import { ArrowUpRight } from "@/components/icons";
import { getAdminDashboard } from "@/features/admin/runtime";
import { ADMIN_DASHBOARD_PATH, POST_LOGIN_PATH } from "@/lib/auth/policy";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin dashboard — LostLink",
  robots: { index: false, follow: false },
};

const dates = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeZone: "Asia/Singapore",
});
const activityTimes = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});
const numbers = new Intl.NumberFormat("en-SG");
const returnQuery = new URLSearchParams({ next: ADMIN_DASHBOARD_PATH });

async function Dashboard() {
  const dashboard = await getAdminDashboard();
  if (dashboard.status === "guest") redirect(`/login?${returnQuery}`);
  if (dashboard.status === "unverified") redirect(`/verify-email?${returnQuery}`);
  if (dashboard.status === "denied") {
    return (
      <div className="admin-message">
        <h1>Administrator access required</h1>
        <p>This dashboard is available to LostLink administrators.</p>
        <Link href={POST_LOGIN_PATH} className="button button-yellow">Back to Discover</Link>
      </div>
    );
  }

  const { overview } = dashboard;
  const queues = [
    { key: "reports", label: "Pending reports", count: overview.pendingReports },
    { key: "claims", label: "Pending claims", count: overview.pendingClaims },
    { key: "pickups", label: "Reserved pickups", count: overview.reservedPickups },
  ] as const;

  return (
    <>
      <header className="dashboard-heading discover-heading">
        <div>
          <h1>Admin dashboard</h1>
          <p>Review reports, verify ownership, and track community returns.</p>
        </div>
        <Link href="/admin/reports" className="button button-yellow">Review reports <ArrowUpRight /></Link>
      </header>
      <div className="dashboard-overview">
      <nav aria-label="Staff queues" className="dashboard-queues">
        {queues.map(({ key, label, count }) => (
          <Link key={key} href={`/admin/${key}`} prefetch className="dashboard-queue">
            <span className="dashboard-icon" aria-hidden="true"><AdminIcon name={key} /></span>
            <span className="dashboard-count">{numbers.format(count)}</span>
            <span className="dashboard-label">{label}</span>
            <span className="dashboard-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
      <p className="dashboard-returns">
        <span className="dashboard-icon"><span aria-hidden="true">&#10003;</span></span>
        <strong>{numbers.format(overview.completedReturns)}</strong>
        <span className="dashboard-label">Completed returns</span>
      </p>
      </div>
      <div className="dashboard-feeds">
        <section aria-labelledby="pending-reports">
          <div className="dashboard-feed-heading">
            <h2 id="pending-reports">Recent pending reports</h2>
            <Link href="/admin/reports" className="dashboard-view-all">View reports <ArrowUpRight /></Link>
          </div>
          {overview.recentReports.length ? (
            <ul>
              {overview.recentReports.map((report) => (
                <li key={report._id} className="dashboard-report-card">
                  <span className="dashboard-report-thumb" aria-hidden="true">{report.cover
                    ? <Image src={report.cover} alt="" fill sizes="80px" unoptimized />
                    : <AdminIcon name="reports" />}</span>
                  <div className="dashboard-report-copy">
                    <Link href={`/admin/reports/${report._id}`}>{report.title}</Link>
                    <p>{report.description}</p>
                    <div className="dashboard-meta">
                      <span>{report.type === "lost" ? "Lost" : "Found"}</span>
                      <time dateTime={report.createdAt.toISOString()}>{dates.format(report.createdAt)}</time>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="dashboard-feed-empty"><AdminIcon name="reports" /><h3>No reports awaiting review</h3><p>New submissions will appear here for moderation.</p></div>}
        </section>
        <section aria-labelledby="staff-activity">
          <div className="dashboard-feed-heading"><h2 id="staff-activity">Recent staff activity</h2><Link href="/admin/audit" className="dashboard-view-all">Audit logs <ArrowUpRight /></Link></div>
          {overview.recentActivity.length ? (
            <ul>
              {overview.recentActivity.map((activity) => (
                <li key={activity.id}>
                  <Link href={activity.href}>{activity.label}</Link>
                  <time className="dashboard-meta" dateTime={activity.createdAt.toISOString()}>
                    {activityTimes.format(activity.createdAt)} SGT
                  </time>
                </li>
              ))}
            </ul>
          ) : <div className="dashboard-feed-empty"><AdminIcon name="claims" /><h3>No staff activity yet</h3><p>Report decisions, claim reviews, and handoffs will appear here.</p></div>}
        </section>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <main id="admin-main" className="discover-main admin-main admin-dashboard" tabIndex={-1}>
      <Suspense fallback={<p role="status">Loading dashboard…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
