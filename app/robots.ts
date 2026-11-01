import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Crawlers and AI agents may read every public page; API and sign-in routes are off limits.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
