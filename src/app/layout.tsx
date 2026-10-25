import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { AppToaster } from "@/components/toasts";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LostLink — Lost it? Let’s find it.",
  description:
    "Your community’s lost and found, rewired. Discover how LostLink helps connect missing belongings with the people looking for them.",
  applicationName: "LostLink",
  openGraph: {
    title: "LostLink — Lost it? Let’s find it.",
    description:
      "Small things. Big relief. A better way for your community to reconnect with what matters.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
