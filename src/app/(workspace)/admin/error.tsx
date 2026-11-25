"use client";

import Link from "next/link";
import { POST_LOGIN_PATH } from "@/lib/auth/policy";

export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <main className="admin-main admin-message" id="admin-main">
      <h1>Dashboard unavailable</h1>
      <p>LostLink couldn’t load the dashboard. Try again in a moment.</p>
      <button type="button" className="button button-yellow" onClick={retry}>Try again</button>
      <Link href={POST_LOGIN_PATH} className="button">Back to Discover</Link>
    </main>
  );
}
