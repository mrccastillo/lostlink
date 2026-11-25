import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { getCurrentSession } from "@/lib/auth/session";
import { getReportService } from "@/lib/reports/runtime";

async function dismiss(id: string) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user.emailVerified) return;
  await (await getReportService()).dismissFinderAlert(session.user, id);
  revalidatePath("/", "layout");
}

async function FinderAlerts() {
  const session = await getCurrentSession();
  if (!session?.user.emailVerified) return null;
  const alerts = await (await getReportService()).finderAlerts(session.user);
  if (!alerts.length) return null;
  return <aside className="finder-alerts" aria-label="New finder responses">
    {alerts.map(alert => <div key={alert.id}>
      <Link href={`/lost/${alert.lostId}/responses?response=${alert.id}`}>New finder response for {alert.title}</Link>
      <form action={dismiss.bind(null, alert.id)}><button type="submit">Mark as read</button></form>
    </div>)}
  </aside>;
}

export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  return <><Suspense fallback={null}><FinderAlerts /></Suspense>{children}</>;
}
