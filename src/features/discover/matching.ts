import type { Report } from "@/lib/reports/service";

export const MATCH_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
const COMMON_WORDS = new Set("a an and are at for found from have i in is it item left lost my near of on or the this to was were with".split(" "));

export type MatchFields = Pick<Report, "title" | "description" | "category" | "location" | "occurredOn">;

function words(text: string) {
  const tokens = text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(tokens.filter((word) => word.length > 1 && !COMMON_WORDS.has(word)));
}

function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return (2 * shared) / (left.size + right.size);
}

function compare(lost: MatchFields, found: MatchFields) {
  const days = (Date.parse(found.occurredOn) - Date.parse(lost.occurredOn)) / DAY_MS;
  if (!Number.isFinite(days) || days < 0 || days > MATCH_WINDOW_DAYS) return null;

  const lostTitle = words(lost.title);
  const foundTitle = words(found.title);
  const lostDescription = words(lost.description);
  const foundDescription = words(found.description);
  const title = similarity(lostTitle, foundTitle);
  const description = Math.max(
    similarity(lostDescription, foundDescription),
    similarity(lostTitle, foundDescription),
    similarity(lostDescription, foundTitle),
  );
  const location = similarity(words(lost.location), words(found.location));
  const sameCategory = lost.category === found.category;
  // Require item text in addition to any date, location, or category signals.
  if (Math.max(title, description) < 0.25) return null;
  const score = title * 30 + description * 25 + location * 20 + (sameCategory ? 15 : 0)
    + (1 - days / (MATCH_WINDOW_DAYS + 1)) * 10;
  if (score < 32) return null;

  const reasons = [
    title >= 0.25 && "Similar title",
    description >= 0.25 && "Similar description",
    location >= 0.5 && "Similar location",
    sameCategory && "Same category",
    days === 0 ? "Found on the same day" : `Found ${days} ${days === 1 ? "day" : "days"} later`,
  ].filter((reason): reason is string => Boolean(reason));
  return { score, days, reasons };
}

export function rankMatches<T extends MatchFields & { _id: string }>(lost: MatchFields, candidates: T[]) {
  return candidates.flatMap((item) => {
    const match = compare(lost, item);
    return match ? [{ item, ...match }] : [];
  }).sort((a, b) => b.score - a.score || a.days - b.days || a.item._id.localeCompare(b.item._id))
    .slice(0, 5)
    .map(({ item, reasons }) => ({ item, reasons }));
}
