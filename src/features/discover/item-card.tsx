"use client";

import Image from "next/image";
import Link from "next/link";
import { claimPath } from "@/features/claims/policy";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { ArrowUpRight } from "@/components/icons";
import type { Listing } from "./listings";


const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ItemCard({ item }: { item: Listing }) {
  const [open, setOpen] = useState(false);
  const dateLabel = `${item.type === "found" ? "Found" : "Lost"} on`;
  const date = dateFormat.format(new Date(`${item.occurredOn}T00:00:00Z`));
  const cover = item.media[0];
  return (
    <>
      <article className="discover-item">
        <button className="discover-item-button" onClick={() => setOpen(true)} aria-label={`View item: ${item.title}`}>
          <span className="discover-item-photo">
            {cover?.kind === "image" ? <Image src={cover.url} alt="" fill unoptimized sizes="(max-width: 600px) 90vw, 28vw" /> :
              <span className="discover-photo-fallback">{cover ? "Video available" : "No photo"}</span>}
            <span className={`discover-item-badge ${item.type}`}>{item.type === "found" ? "Found" : "Lost"}</span>
          </span>
          <span className="discover-item-category">{item.category}</span>
          <span className="discover-item-name">{item.title}<ArrowUpRight /></span>
          <span className="discover-item-location">{item.location}</span>
          <span className="discover-item-date">{dateLabel} <time dateTime={item.occurredOn}>{date}</time></span>
        </button>
      </article>
      <Dialog open={open} onClose={() => setOpen(false)} title={item.title}>
        {open && item.media.map((file, index) => <div key={file.url} className="detail-photo">
          {file.kind === "image" ? <Image src={file.url} alt={`${item.title}, photo ${index + 1}`} fill unoptimized sizes="480px" /> :
            <video src={file.url} controls preload="metadata" aria-label={`${item.title}, video ${index + 1}`} />}
        </div>)}
        <p className="eyebrow dialog-label">{item.type} / {item.category} / {item.location}</p>
        <p className="discover-item-date">{dateLabel} <time dateTime={item.occurredOn}>{date}</time></p>
        <p className="dialog-copy">{item.description}</p>
        <p className="dialog-note">Item status: {item.lifecycle}</p>
        {item.canClaim && <Link href={claimPath(item.id)} onClick={() => setOpen(false)} className="button button-yellow claim-item-button">Claim / verify ownership <ArrowUpRight /></Link>}
      </Dialog>
    </>
  );
}
