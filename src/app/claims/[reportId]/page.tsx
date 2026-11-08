import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { sampleReports } from "@/features/landing/content";
import { getCurrentSession } from "@/lib/auth/session";
import { getClaimService } from "@/lib/claims/runtime";
import { ClaimForm } from "@/features/claims/claim-form";
import { ClaimStatus } from "@/features/claims/claim-status";
import { claimPath } from "@/features/claims/policy";
import { REPORT_UUID } from "@/features/reports/policy";
import type { ClaimItem, ClaimSummary } from "@/lib/claims/service";
import "../../discover/discover.css";
import "@/features/post/post-modal.css";
import "../claims.css";

export const metadata: Metadata = { title: "Verify ownership — LostLink", robots: { index: false, follow: false } };

async function Content({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const example = sampleReports.find((item) => item.id === reportId && item.status === "found");
  let item: ClaimItem;
  let claim: ClaimSummary | null = null;
  if (example) item = { id: example.id, title: example.name, category: example.category, location: example.location, occurredOn: example.occurredOn, available: true };
  else {
    if (!REPORT_UUID.test(reportId)) notFound();
    const session = await getCurrentSession();
    const next = encodeURIComponent(claimPath(reportId));
    if (!session) redirect(`/login?next=${next}`);
    if (!session.user.emailVerified) redirect(`/verify-email?next=${next}`);
    const service = await getClaimService();
    const data = await service.load(session.user, reportId);
    if (!data) notFound();
    item = data.item; claim = data.claim;
  }
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.occurredOn}T00:00:00Z`));
  return (
    <>
      <Link href="/discover" className="claim-back">← Back to Discover</Link>
      <header className="claim-page-heading"><p className="eyebrow">OWNERSHIP VERIFICATION</p><h1>Verify this item is yours</h1><p>Share proof privately and track your claim through staff review.</p></header>
      {example && <div className="claim-preview-banner"><strong>EXAMPLE PREVIEW</strong><p>This item is illustrative. You can explore the form; no claim, answers, or proof files will be saved or sent.</p></div>}
      <ClaimStatus claim={claim} preview={Boolean(example)} />
      <section className="claim-item-summary" aria-label="Item being claimed">
        {example ? <Image src={example.image} alt={example.alt} width={96} height={96} /> : <span className="claim-summary-icon" aria-hidden="true">↗</span>}
        <div><p className="eyebrow">{item.category}</p><h2>{item.title}</h2><p>{item.location}</p><p>Found on <time dateTime={item.occurredOn}>{date}</time></p></div>
        <span className="claim-private-label">PRIVATE PROOF</span>
      </section>
      {!claim && item.available ? <ClaimForm reportId={item.id} preview={Boolean(example)} /> : !claim ? <p className="claim-privacy">This item is no longer open for new claims.</p> : <div className="claim-privacy"><strong>Your claim is {claim.status}.</strong><p>Submitted {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "Asia/Singapore" }).format(new Date(claim.createdAt))}. Your ownership answers and evidence stay private.</p><Link href="/claims">View my claims →</Link></div>}
    </>
  );
}
export default function ClaimPage(props: { params: Promise<{ reportId: string }> }) {
  return <div className="discover-shell"><a className="skip-link" href="#claim-main">Skip to ownership verification</a><AppSidebar active="claims" /><div className="discover-workspace"><div className="discover-topbar"><span>CLAIMS & VERIFICATION</span></div><main id="claim-main" className="claim-main"><Suspense fallback={<p role="status">Loading ownership verification…</p>}><Content {...props} /></Suspense></main></div></div>;
}
