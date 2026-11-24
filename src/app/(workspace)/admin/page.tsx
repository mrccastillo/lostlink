import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminIcon } from "@/components/admin-icon";
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
      <header className="dashboard-heading">
        <h1>Admin dashboard</h1>
      </header>
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
        Completed returns <strong>{numbers.format(overview.completedReturns)}</strong>
      </p>
      <div className="dashboard-feeds">
        <section aria-labelledby="pending-reports">
          <h2 id="pending-reports">Recent pending reports</h2>
          {overview.recentReports.length ? (
            <ul>
              {overview.recentReports.map((report) => (
                <li key={report._id}>
                  <Link href={`/admin/reports/${report._id}`}>{report.title}</Link>
                  <div className="dashboard-meta">
                    <span>{report.type === "lost" ? "Lost" : "Found"}</span>
                    <time dateTime={report.createdAt.toISOString()}>{dates.format(report.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p>No reports awaiting review.</p>}
        </section>
        <section aria-labelledby="staff-activity">
          <h2 id="staff-activity">Recent staff activity</h2>
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
          ) : <p>No staff activity yet.</p>}
        </section>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <main id="admin-main" className="admin-main admin-dashboard" tabIndex={-1}>
      <Suspense fallback={<p role="status">Loading dashboard…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
