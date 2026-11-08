import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";

export const metadata: Metadata = { title: "Log in — LostLink" };
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return <AuthScreen mode="login" searchParams={searchParams} />;
}
