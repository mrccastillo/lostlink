import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";

export const metadata: Metadata = { title: "Reset your password — LostLink" };
export default function ForgotPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  return <AuthScreen mode="forgot" searchParams={searchParams} />;
}
