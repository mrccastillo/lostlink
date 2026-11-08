"use client";

import Image from "next/image";
import Link from "next/link";
import { claimPath } from "@/features/claims/policy";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { ArrowUpRight } from "@/components/icons";
import type { sampleReports } from "@/features/landing/content";

type Item = (typeof sampleReports)[number];
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ItemCard({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const dateLabel = `${item.status === "found" ? "Found" : "Lost"} on`;
  const date = dateFormat.format(new Date(`${item.occurredOn}T00:00:00Z`));
  return (
    <>
      <article className="discover-item">
        <button className="discover-item-button" onClick={() => setOpen(true)} aria-label={`View example: ${item.name}`}>
          <span className="discover-item-photo">
            <Image src={item.image} alt={item.alt} fill sizes="(max-width: 600px) 90vw, (max-width: 1100px) 42vw, 28vw" placeholder="blur" />
            <span className={`discover-item-badge ${item.status}`}>{item.status === "found" ? "Found" : "Lost"}</span>
          </span>
          <span className="discover-item-category">{item.category}</span>
          <span className="discover-item-name">{item.name}<ArrowUpRight /></span>
          <span className="discover-item-location">{item.location}</span>
          <span className="discover-item-date">{dateLabel} <time dateTime={item.occurredOn}>{date}</time></span>
        </button>
      </article>
      <Dialog open={open} onClose={() => setOpen(false)} title={item.name}>
        <div className="detail-photo"><Image src={item.image} alt={item.alt} fill sizes="(max-width: 600px) 85vw, 480px" /></div>
        <p className="eyebrow dialog-label">{item.status} / {item.location}</p>
        <p className="discover-item-date">{dateLabel} <time dateTime={item.occurredOn}>{date}</time></p>
        <p className="dialog-copy">{item.description}</p>
        <p className="dialog-note">This is an example listing. Keep identifying details and contact information private.</p>
        {item.status === "found" && <Link href={claimPath(item.id)} onClick={() => setOpen(false)} className="button button-yellow claim-item-button">Claim / verify ownership <ArrowUpRight /></Link>}
      </Dialog>
    </>
  );
}
