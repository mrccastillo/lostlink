import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { canPost, POST_ITEM_LOGIN_PATH } from "@/lib/auth/policy";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ArrowUpRight } from "@/components/icons";
import "../(auth)/auth.css";

export const metadata: Metadata = {
  title: "Post an item — LostLink",
  robots: { index: false, follow: false },
};

async function PostingAccess() {
  const session = await getCurrentSession();
  if (!session) redirect(POST_ITEM_LOGIN_PATH);
  if (!session.user.emailVerified) redirect("/verify-email?next=%2Fpost");
  const approved = canPost(session.user);
  return (
    <main className="account-status">
      <p className="eyebrow">Your LostLink account</p>
      <h1>{approved ? "You’re connected." : "One more connection."}</h1>
      <p>
        Signed in as <strong>{session.user.name}</strong>.
      </p>
      <p className="auth-notice">
        {approved
          ? "Your email and community access are verified. Item reporting is being prepared—check back soon to post your item."
          : "Your email is verified. Your organization’s team still needs to approve your community access before you can post."}
      </p>
      <p>
        Need help with an item now? Contact your organization’s lost-and-found
        team.
      </p>
      <SignOutButton />
    </main>
  );
}

export default function PostPage() {
  return (
    <div className="account-page">
      <header className="site-header page-gutter">
        <Link className="wordmark" href="/">
          <span className="brand-mark">
            <ArrowUpRight />
          </span>
          LostLink
        </Link>
        <Link href="/">Back to home ↗</Link>
      </header>
      <Suspense
        fallback={
          <p className="auth-loading" role="status">
            Checking your account…
          </p>
        }
      >
        <PostingAccess />
      </Suspense>
    </div>
  );
}
