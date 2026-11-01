import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://clipwellai.vercel.app";
const TITLE = `${APP_NAME} · ${APP_TAGLINE}`;
const DESCRIPTION = "Turn long videos into on-brand Shorts and Reels. Learns your style with every edit.";
const SHARE_DESCRIPTION = "Turn podcasts and long videos into on-brand Shorts and Reels. Finds the moments worth posting and learns your brand voice from every edit.";
const SHARE_IMAGE = { url: "/og.jpg", width: 1200, height: 630, alt: `${APP_NAME}: long videos in, on-brand Reels out` };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // Link previews on LinkedIn, WhatsApp, X and Slack.
  openGraph: { type: "website", url: "/", siteName: APP_NAME, title: TITLE, description: SHARE_DESCRIPTION, images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: SHARE_DESCRIPTION, images: [SHARE_IMAGE.url] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
