import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";

export const metadata: Metadata = { title: "Verify your email — LostLink" };
export default function VerifyPage({
  searchParams,
}: PageProps<"/verify-email">) {
  return <AuthScreen mode="verify" searchParams={searchParams} />;
}
