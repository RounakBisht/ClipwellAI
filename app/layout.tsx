import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

export const metadata: Metadata = {
  title: `${APP_NAME} · ${APP_TAGLINE}`,
  description: "Turn long videos into on-brand Shorts and Reels. Learns your style with every edit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
