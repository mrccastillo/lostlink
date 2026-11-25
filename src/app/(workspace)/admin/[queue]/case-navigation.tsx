import { notFound } from "next/navigation";

export function queryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) notFound();
  return value;
}
export function pageLink(base: string, values: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  return query.size ? base + "?" + query : base;
}
const formatter = new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" });
export function CaseTime({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{formatter.format(date)} SGT</time>;
}
