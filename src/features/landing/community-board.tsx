"use client";

import Image from "next/image";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { ArrowRight, ArrowUpRight, SearchIcon } from "@/components/icons";
import { sampleReports } from "@/features/landing/content";

const filters = [
  { value: "all", label: "Everything" },
  { value: "found", label: "Found" },
  { value: "lost", label: "Lost" },
] as const;

type Filter = (typeof filters)[number]["value"];
type Report = (typeof sampleReports)[number];

export function CommunityBoard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<Report["id"] | null>(null);
  const selected = sampleReports.find((report) => report.id === selectedId);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleReports = sampleReports.filter(
    (report) =>
      (filter === "all" || report.status === filter) &&
      `${report.title} ${report.name} ${report.location} ${report.category}`
        .toLowerCase()
        .includes(normalizedQuery),
  );

  return (
    <section
      className="board-section page-gutter section-space"
      id="board"
      aria-labelledby="board-title"
    >
      <div className="section-heading reveal">
        <div>
          <p className="eyebrow">[ 01 — The community board ]</p>
          <h2 id="board-title">
            Missing stuff.
            <br />
            <span className="outline-text">Meet good people.</span>
          </h2>
        </div>
        <p className="section-description">
          A bag. A pair of headphones.
          <br />A whole lot of hope.
          <br />
          Here’s what finding it could look like.
        </p>
      </div>
      <div className="board-toolbar">
        <div
          className="filters"
          role="group"
          aria-label="Filter example reports"
        >
          {filters.map((option) => (
            <button
              key={option.value}
              className="filter-button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <SearchIcon />
          <span className="sr-only">Search example items</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What are we looking for?"
          />
        </label>
      </div>
      <div className="report-grid">
        {visibleReports.map((report) => (
          <article className="report-card" key={report.id}>
            <button
              className="report-card-button"
              onClick={() => setSelectedId(report.id)}
              aria-label={`View example: ${report.name}`}
            >
              <span className="report-photo">
                <Image
                  src={report.image}
                  alt={report.alt}
                  fill
                  sizes="(max-width: 650px) 90vw, (max-width: 1000px) 45vw, 30vw"
                  placeholder="blur"
                />
                <span
                  className={`report-badge ${report.status === "lost" ? "is-lost" : ""}`}
                >
                  {report.status === "found" ? "Found it!" : "Missing!"}
                </span>
              </span>
              <span className="report-name">
                <span>{report.title}</span>
                <ArrowUpRight />
              </span>
              <span className="report-location">
                {report.name} / {report.location}
              </span>
              <span className="report-foot">
                <span>Example report</span>
                <span>
                  Take a look <ArrowRight />
                </span>
              </span>
            </button>
          </article>
        ))}
      </div>
      {visibleReports.length === 0 && (
        <div className="board-empty">
          <h3>No matches. Yet.</h3>
          <p>Try “backpack”, “headphones”, or “camera”.</p>
          <button
            className="button button-yellow"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Reset the board
            <ArrowRight />
          </button>
        </div>
      )}
      <div className="board-caption">
        <p role="status" aria-live="polite">
          {visibleReports.length} example{" "}
          {visibleReports.length === 1 ? "report" : "reports"}
        </p>
        <p>Illustrative items. Real possibilities.</p>
      </div>
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? "Example report"}
      >
        {selected && (
          <>
            <div className="detail-photo">
              <Image
                src={selected.image}
                alt={selected.alt}
                fill
                sizes="(max-width: 600px) 85vw, 480px"
              />
            </div>
            <p className="eyebrow dialog-label">
              {selected.status} / {selected.location}
            </p>
            <p className="dialog-copy">{selected.description}</p>
            <p className="dialog-note">
              This is an example, not a real report. Live reports and ownership
              claims are coming soon.
            </p>
            <a
              className="button button-yellow"
              href="#how-it-works"
              onClick={() => setSelectedId(null)}
            >
              See how it works
              <ArrowUpRight />
            </a>
          </>
        )}
      </Dialog>
    </section>
  );
}
