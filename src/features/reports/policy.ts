export const REPORT_CATEGORIES = ["Bags & accessories", "Electronics", "Clothing", "Keys", "Documents", "Other"] as const;
export class ReportError extends Error {}
export type ReportInput = {
  requestId: string; type: "lost" | "found"; title: string; category: string;
  location: string; occurredOn: string; description: string; attachments: string[];
};
export const REPORT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateReport(input: ReportInput, now = new Date()): ReportInput {
  const result = { ...input, title: input.title.trim(), location: input.location.trim(), description: input.description.trim() };
  if (!REPORT_UUID.test(result.requestId)) throw new ReportError("Please reopen the form and try again.");
  if (!["lost", "found"].includes(result.type)) throw new ReportError("Choose lost or found.");
  if (result.title.length < 3 || result.title.length > 100) throw new ReportError("Use an item title between 3 and 100 characters.");
  if (!REPORT_CATEGORIES.some((category) => category === result.category)) throw new ReportError("Choose an item category.");
  if (result.location.length < 2 || result.location.length > 120) throw new ReportError("Use a location between 2 and 120 characters.");
  if (result.description.length < 10 || result.description.length > 1500) throw new ReportError("Use a description between 10 and 1,500 characters.");
  const date = new Date(`${result.occurredOn}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.occurredOn) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result.occurredOn || result.occurredOn > new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(now))
    throw new ReportError("Enter a valid date that is not in the future (Singapore time).");
  if (result.attachments.length > 5 || new Set(result.attachments).size !== result.attachments.length || result.attachments.some((id) => !REPORT_UUID.test(id))) throw new ReportError("Choose up to five different attachments.");
  return result;
}
