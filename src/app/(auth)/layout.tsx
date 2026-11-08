import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, Asterisk } from "@/components/icons";
import { backpack } from "@/features/landing/content";
import "./auth.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#account-access">
        Skip to account access
      </a>
      <aside className="auth-story">
        <Link href="/" className="wordmark" aria-label="LostLink home">
          <span className="brand-mark">
            <ArrowUpRight />
          </span>
          LostLink
        </Link>
        <div className="auth-story-content">
          <p className="eyebrow">A small act. A big comeback.</p>
          <h2>
            Good people.
            <br />
            Great returns<span>.</span>
          </h2>
          <div className="auth-story-photo">
            <Image
              src={backpack}
              alt="A navy backpack ready to find its way home"
              fill
              sizes="(max-width: 760px) 0px, 320px"
            />
            <span className="auth-stamp">
              <Asterisk />
              Less lost.
              <br />
              More found.
            </span>
          </div>
          <p>
            A shared place to reconnect with the things—and people—that matter.
          </p>
        </div>
        <span className="eyebrow auth-story-foot">
          Your community’s lost & found. Rewired.
        </span>
      </aside>
      <main id="account-access" className="auth-main">
        <Link className="auth-home" href="/">
          ← Back to the board
        </Link>
        {children}
        <p className="auth-footer">Small things. Big relief. © 2026 LostLink</p>
      </main>
    </div>
  );
}
