import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { TOOLS } from "@/lib/tool-list";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    ...TOOLS.map((t) => ({ url: absoluteUrl(`/${t.slug}/`), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
