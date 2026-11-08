"use server";
import { getCurrentSession } from "@/lib/auth/session";
import { getClaimService } from "@/lib/claims/runtime";
import { MediaError } from "@/lib/media/policy";
import { ClaimError } from "./policy";
export async function submitClaim(data: FormData): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    if (!session?.user.emailVerified) throw new ClaimError("Sign in with a verified account to submit a claim.");
    const text = (key: string) => { const value = data.get(key); return typeof value === "string" ? value : ""; };
    const files = data.getAll("attachments");
    if (files.some((value) => typeof value !== "string")) throw new ClaimError("Choose valid proof attachments.");
    const service = await getClaimService();
    await service.submit(session.user, { requestId: text("requestId"), reportId: text("reportId"), identifyingDetail: text("identifyingDetail"), circumstances: text("circumstances"), additionalContext: text("additionalContext"), attachments: files.filter((value): value is string => typeof value === "string"), confirmed: data.get("confirmed") === "on" });
    return { success: true, message: "Your claim has been submitted for staff review. This does not reserve the item or confirm ownership." };
  } catch (error) {
    if (error instanceof ClaimError || error instanceof MediaError) return { success: false, message: error.message };
    console.error("CLAIM_SUBMIT_FAILED");
    return { success: false, message: "We couldn’t submit your claim. Your answers are still here; please try again." };
  }
}
