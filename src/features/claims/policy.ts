import { REPORT_UUID } from "@/features/reports/policy";

export class ClaimError extends Error {}
export type ClaimInput = { requestId: string; reportId: string; identifyingDetail: string; circumstances: string; additionalContext: string; attachments: string[]; confirmed: boolean };
export function validateClaim(raw: ClaimInput): ClaimInput {
  const input = { ...raw, identifyingDetail: raw.identifyingDetail.trim(), circumstances: raw.circumstances.trim(), additionalContext: raw.additionalContext.trim() };
  if (!REPORT_UUID.test(input.requestId) || !REPORT_UUID.test(input.reportId)) throw new ClaimError("This item is unavailable for claims.");
  if (input.identifyingDetail.length < 10 || input.identifyingDetail.length > 1500) throw new ClaimError("Describe an identifying detail in 10 to 1,500 characters.");
  if (input.circumstances.length < 10 || input.circumstances.length > 1500) throw new ClaimError("Describe when and where you last had the item in 10 to 1,500 characters.");
  if (input.additionalContext.length > 1500) throw new ClaimError("Keep additional context within 1,500 characters.");
  if (!input.confirmed) throw new ClaimError("Confirm that your information is accurate and the item belongs to you.");
  if (input.attachments.length > 5 || new Set(input.attachments).size !== input.attachments.length || input.attachments.some((id) => !REPORT_UUID.test(id))) throw new ClaimError("Choose up to five different proof attachments.");
  return input;
}
export function claimPath(id: string) { return `/claims/${encodeURIComponent(id)}`; }
export function safeClaimPath(value: unknown): string | null {
  return typeof value === "string" && /^\/claims\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
