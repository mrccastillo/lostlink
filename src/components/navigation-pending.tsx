"use client";

import { useLinkStatus } from "next/link";

export function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="navigation-pending" role="status"><span className="sr-only">Loading page</span></span> : null;
}
