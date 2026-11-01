import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Public pages. The studio itself sits behind Google sign-in, so it isn't listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/llms.txt`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];
}
