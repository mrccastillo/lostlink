import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentSession } from "@/lib/auth/session";
import { getClaimService } from "@/lib/claims/runtime";
import { claimPath } from "@/features/claims/policy";
import "../discover/discover.css";
import "./claims.css";

export const metadata: Metadata = { title: "My claims — LostLink", robots: { index: false, follow: false } };
async function Claims() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=%2Fclaims");
  if (!session.user.emailVerified) redirect("/verify-email?next=%2Fclaims");
  const service = await getClaimService();
  const claims = await service.list(session.user);
  return <><header className="claim-page-heading"><p className="eyebrow">YOUR CLAIMS</p><h1>Claim status & verification</h1><p>Your latest 50 ownership requests, visible only to you.</p></header>{claims.length ? <div className="claim-list">{claims.map((claim) => <Link key={claim.id} href={claimPath(claim.reportId)}>Claim #{claim.id.slice(0, 8).toUpperCase()}<span>{claim.status} ↗</span></Link>)}</div> : <div className="claim-privacy"><strong>No claims yet.</strong><p>Open a found item on Discover and choose Claim / verify ownership to share your proof.</p><Link href="/discover" className="claim-back">Browse found items →</Link></div>}</>;
}
export default function ClaimsPage() { return <div className="discover-shell"><a className="skip-link" href="#claims-main">Skip to claims</a><AppSidebar active="claims" /><div className="discover-workspace"><main className="claim-main" id="claims-main"><Suspense fallback={<p role="status">Loading your claims…</p>}><Claims /></Suspense></main></div></div>; }
