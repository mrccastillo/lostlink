"use client";
import Link from "next/link";
export default function ClaimsError({ reset }: { reset: () => void }) {
  return <main className="page-gutter section-space"><h1>Claims are temporarily unavailable</h1><p>Please try again. Your existing claims have not been changed.</p><button type="button" className="button button-yellow" onClick={reset}>Try again</button><Link href="/discover" className="button">Back to Discover</Link></main>;
}
