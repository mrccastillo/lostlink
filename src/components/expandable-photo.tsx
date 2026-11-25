"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { Dialog } from "./dialog";

export function ExpandablePhoto({ src, alt, unoptimized = false }: { src: ImageProps["src"]; alt: string; unoptimized?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <>
    <button type="button" className="detail-photo photo-trigger" aria-label={`View full photo: ${alt}`} aria-haspopup="dialog" onClick={() => setExpanded(true)}>
      <Image src={src} alt={alt} fill unoptimized={unoptimized} sizes="(max-width: 600px) 85vw, 480px" />
      <span aria-hidden="true">View full photo</span>
    </button>
    {expanded && <Dialog open title="Full photo" className="photo-viewer" onClose={() => setExpanded(false)}>
      <div className="full-photo-frame"><Image src={src} alt={alt} fill unoptimized sizes="100vw" /></div>
    </Dialog>}
  </>;
}
