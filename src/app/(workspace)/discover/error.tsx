"use client";

export default function DiscoverError({ reset }: { reset: () => void }) {
  return <main className="page-gutter section-space">
    <h1>Discover listings could not be loaded</h1>
    <button type="button" className="button button-yellow" onClick={reset}>Try again</button>
  </main>;
}
