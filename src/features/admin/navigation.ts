export const adminQueues = [
  { key: "reports", label: "Review reports" },
  { key: "claims", label: "Review claims" },
  { key: "pickups", label: "Manage pickups" },
] as const;

export type AdminQueue = (typeof adminQueues)[number]["key"];

export const directoryPages = [
  { key: "users", label: "All users" },
  { key: "admins", label: "All admins" },
  { key: "audit", label: "Audit logs" },
] as const;
export type DirectoryPage = (typeof directoryPages)[number]["key"];
