import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";

export const metadata: Metadata = { title: "Choose a new password — LostLink" };
export default function ResetPage({
  searchParams,
}: PageProps<"/reset-password">) {
  return <AuthScreen mode="reset" searchParams={searchParams} />;
}
