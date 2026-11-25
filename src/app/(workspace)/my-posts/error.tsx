"use client";
import Link from "next/link";
export default function MyPostsError({ reset }: { reset: () => void }) {
  return <main className="page-gutter section-space"><h1>Your posts couldn’t be loaded</h1><p>Please try again in a moment.</p><button type="button" className="button button-yellow" onClick={reset}>Try again</button><Link href="/discover" className="button">Back to Discover</Link></main>;
}
