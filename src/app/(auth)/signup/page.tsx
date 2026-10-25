import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";

export const metadata: Metadata = { title: "Sign up — LostLink" };
export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return <AuthScreen mode="signup" searchParams={searchParams} />;
}
