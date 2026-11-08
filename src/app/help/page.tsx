import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { faqs, recoverySteps } from "@/features/landing/content";
import "../discover/discover.css";

export const metadata: Metadata = { title: "Help & FAQ — LostLink" };

export default function HelpPage() {
  return (
    <div className="discover-shell">
      <a className="skip-link" href="#help-main">Skip to help</a>
      <AppSidebar active="help" />
      <div className="discover-workspace">
        <main id="help-main" className="discover-main">
          <div className="discover-heading"><div><h1>Help & FAQ</h1><p>Reporting, ownership, and getting an item back.</p></div></div>
          <section id="how-it-works" className="workspace-help" aria-labelledby="steps-title">
            <h2 id="steps-title">How it works</h2>
            <p>You can submit a report for review and claim eligible published found items. Live board publishing, staff decisions, and handoff tracking are still being prepared.</p>
            <ol>{recoverySteps.map((step) => <li key={step.title}><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
          </section>
          <section className="workspace-help" aria-labelledby="faq-title">
            <h2 id="faq-title">Frequently asked questions</h2>
            <div className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span className="faq-plus" aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
          </section>
        </main>
      </div>
    </div>
  );
}
