import Image from "next/image";
import { ArrowRight, ArrowUpRight, Asterisk } from "@/components/icons";
import { CommunityBoard } from "@/features/landing/community-board";
import { backpack, faqs, recoverySteps } from "@/features/landing/content";
import { Header } from "@/features/landing/header";
import { ReportButton } from "@/features/landing/report-button";

export default function Home() {
  return (
    <div id="top">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <section className="hero page-gutter" aria-labelledby="hero-title">
          <div className="hero-top eyebrow">
            <span>Your community’s lost & found. Rewired.</span>
            <span className="hero-signal">
              <span className="signal-dot" />
              Good people. Good returns.
            </span>
          </div>
          <h1 className="hero-masthead" id="hero-title">
            LOSTLINK
            <Asterisk />
          </h1>
          <div className="hero-body">
            <div className="hero-copy">
              <h2>
                Lost it?
                <br />
                Let’s find it.
              </h2>
              <p>
                Less “has anyone seen my…?”
                <br />
                More “hey, I think that’s yours.”
                <br />
                Your stuff deserves a comeback.
              </p>
              <div className="hero-actions">
                <a href="#board" className="button button-dark">
                  Hit the board
                  <ArrowUpRight />
                </a>
                <ReportButton className="text-button">
                  Found something?
                </ReportButton>
              </div>
            </div>
            <div className="hero-photo-scene">
              <svg
                className="hand-arrow"
                viewBox="0 0 90 90"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 13c52-5 58 28 34 53m-4-22 2 25 25-7"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <figure className="pinned-photo">
                <span className="photo-tape" aria-hidden="true" />
                <div className="hero-photo">
                  <Image
                    src={backpack}
                    alt="Navy backpack waiting to find its way back to its owner"
                    fill
                    sizes="(max-width: 650px) 70vw, (max-width: 1000px) 42vw, 440px"
                    preload
                    placeholder="blur"
                  />
                </div>
                <figcaption>
                  <span>Everyday things. Second chances.</span>
                  <ArrowUpRight />
                </figcaption>
              </figure>
              <div className="karma-sticker" aria-hidden="true">
                <Asterisk />
                <span>
                  Good
                  <br />
                  karma.
                </span>
              </div>
            </div>
          </div>
          <div className="hero-foot eyebrow">
            <span>Small things. Big relief.</span>
            <a href="#board">
              Scroll to reconnect <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <div
          className="statement-strip"
          aria-label="Found something? Make someone’s day. Lost something? Let’s bring it home."
        >
          <span>
            Found something? Make someone’s day.
            <Asterisk />
          </span>
          <span>
            Lost something? Let’s bring it home.
            <Asterisk />
          </span>
          <span aria-hidden="true">
            Found something? Make someone’s day.
            <Asterisk />
          </span>
        </div>
        <CommunityBoard />
        <section
          className="workflow-section page-gutter section-space"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="workflow-intro reveal">
            <p className="eyebrow">[ 02 — The game plan ]</p>
            <h2 id="workflow-title">
              No detective
              <br />
              degree
              <br />
              required.
            </h2>
            <p>
              Three small steps.
              <br />
              One very happy reunion.
            </p>
            <svg
              className="workflow-arrow"
              viewBox="0 0 100 90"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13 10c-5 47 20 61 63 44m-20-8 24 6-13 22"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <ol className="recovery-steps">
            {recoverySteps.map((step, index) => (
              <li className="reveal" key={step.title}>
                <span className="step-number">0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="faq-section page-gutter section-space"
          id="questions"
          aria-labelledby="faq-title"
        >
          <div className="faq-intro reveal">
            <p className="eyebrow">[ 03 — A little clarity ]</p>
            <h2 id="faq-title">
              Good
              <br />
              questions.
            </h2>
            <p>Let’s clear a few things up.</p>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.question} name="landing-faq">
                <summary>
                  {faq.question}
                  <span className="faq-plus" aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section
          className="closing-section page-gutter reveal"
          aria-labelledby="closing-title"
        >
          <div>
            <p className="eyebrow">A small act goes a long way.</p>
            <h2 id="closing-title">
              Be someone’s
              <br />
              “oh, thank goodness.”
            </h2>
            <p>Found a thing? Do a good thing.</p>
          </div>
          <ReportButton className="button button-yellow closing-button" />
        </section>
      </main>
      <footer className="site-footer page-gutter">
        <div className="footer-top">
          <a className="wordmark" href="#top">
            LOSTLINK
            <ArrowUpRight />
          </a>
          <p>Less lost. More found.</p>
          <a href="#top" className="footer-back">
            Back to top
            <ArrowRight />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 LostLink</span>
          <span>Built for the good in your community.</span>
          <a href="#questions">Questions? Start here.</a>
        </div>
      </footer>
    </div>
  );
}
