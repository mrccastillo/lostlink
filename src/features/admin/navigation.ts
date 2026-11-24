export const adminQueues = [
  { key: "reports", label: "Review reports" },
  { key: "claims", label: "Review claims" },
  { key: "pickups", label: "Manage pickups" },
] as const;

export type AdminQueue = (typeof adminQueues)[number]["key"];
