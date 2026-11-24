export const adminQueues = [
  { key: "reports", label: "Report moderation" },
  { key: "claims", label: "Claim review" },
  { key: "pickups", label: "Reserved pickups" },
] as const;

export type AdminQueue = (typeof adminQueues)[number]["key"];
