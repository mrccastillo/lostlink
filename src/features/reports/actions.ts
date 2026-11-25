"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { getReportService } from "@/lib/reports/runtime";
import { ReportError } from "./policy";
import { MediaError } from "@/lib/media/policy";
import { MongoError } from "mongodb";

export async function submitReport(data: FormData): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getCurrentSession();
    if (!session?.user.emailVerified) throw new ReportError("Sign in with a verified account before posting.");
    const text = (key: string) => { const value = data.get(key); return typeof value === "string" ? value : ""; };
    const attachments = data.getAll("attachments");
    if (attachments.some((value) => typeof value !== "string")) throw new ReportError("Choose valid attachments.");
    const type = text("type");
    if (type !== "lost" && type !== "found") throw new ReportError("Choose lost or found.");
    const service = await getReportService();
    await service.submit(session.user, { requestId: text("requestId"), type, title: text("title"), category: text("category"), location: text("location"), occurredOn: text("occurredOn"), description: text("description"), attachments: attachments.filter((value): value is string => typeof value === "string") }, data.has("respondingTo") ? text("respondingTo") : undefined);
    return { success: true, message: "Report submitted for review. Your selected attachments are saved with it." };
  } catch (error) {
    if (error instanceof ReportError || error instanceof MediaError) return { success: false, message: error.message };
    // Database codes identify failures without logging report contents or credentials.
    console.error("REPORT_SUBMIT_FAILED", error instanceof MongoError
      ? { category: "database", kind: /^[A-Za-z]+$/.test(error.name) ? error.name : "MongoError", code: typeof error.code === "number" ? error.code : undefined }
      : { category: "unexpected" });
    return { success: false, message: "We couldn’t save your report. Your details are still here; please try again." };
  }
}
