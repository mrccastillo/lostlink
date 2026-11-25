import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { faqs, recoverySteps } from "@/features/landing/content";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Help & FAQ — LostLink" };

async function Help() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=%2Fhelp");
  if (!session.user.emailVerified) redirect("/verify-email?next=%2Fhelp");
  return (
        <main id="help-main" className="discover-main">
          <div className="discover-heading"><div><h1>Help & FAQ</h1><p>Reporting, ownership, and getting an item back.</p></div></div>
          <section id="how-it-works" className="workspace-help" aria-labelledby="steps-title">
            <h2 id="steps-title">How it works</h2>
            <p>Staff review submitted reports before they appear on Discover. If a found item is yours, submit private proof and check My claims for the decision. Staff record the return when you collect the item.</p>
            <ol>{recoverySteps.map((step) => <li key={step.title}><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
          </section>
          <section className="workspace-help" aria-labelledby="faq-title">
            <h2 id="faq-title">Frequently asked questions</h2>
            <div className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span className="faq-plus" aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
          </section>
        </main>
  );
}

export default function HelpPage() {
  return <Suspense fallback={<p role="status">Opening Help…</p>}><Help /></Suspense>;
}
