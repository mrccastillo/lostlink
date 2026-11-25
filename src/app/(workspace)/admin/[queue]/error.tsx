"use client";
import Link from "next/link";
export default function CaseError({ retry }: { retry: () => void }) {
  return <section className="case-section"><h1>Case work unavailable</h1>
    <p>We couldn’t load this page. Try again in a moment.</p>
    <button className="button button-yellow" onClick={retry}>Try again</button> <Link href="/admin">Admin dashboard</Link></section>;
}
