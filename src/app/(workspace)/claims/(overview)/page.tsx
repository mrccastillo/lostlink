import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getClaimService } from "@/lib/claims/runtime";
import { claimPath } from "@/features/claims/policy";

export const metadata: Metadata = { title: "My claims — LostLink", robots: { index: false, follow: false } };
export default async function ClaimsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=%2Fclaims");
  if (!session.user.emailVerified) redirect("/verify-email?next=%2Fclaims");
  const service = await getClaimService();
  const claims = await service.list(session.user);
  return claims.length ? <div className="claim-list">{claims.map((claim) => <Link key={claim.id} href={claimPath(claim.reportId)}>Claim #{claim.id.slice(0, 8).toUpperCase()}<span>{claim.status} ↗</span></Link>)}</div> : <div className="claim-privacy"><strong>No claims yet.</strong><p>Open a found item on Discover and choose Claim / verify ownership to share your proof.</p><Link href="/discover" className="claim-back">Browse found items →</Link></div>;
}
