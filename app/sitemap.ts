import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://clippingreward.com";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: baseUrl + "/book",
      lastModified: new Date(),
    },
    {
      url: baseUrl + "/privacy",
      lastModified: new Date(),
    },
    {
      url: baseUrl + "/terms",
      lastModified: new Date(),
    },
  ];
}
