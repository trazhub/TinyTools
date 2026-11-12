import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOLS } from "@/lib/tool-list";
import { SITE, absoluteUrl } from "@/lib/site";
import { VIEWS } from "@/tools/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) return {};
  return { title: `${tool.name} — ${SITE.name}`, description: tool.description, alternates: { canonical: absoluteUrl(`/${tool.slug}/`) } };
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) notFound();
  const View = VIEWS[tool.slug];
  if (!View) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm">
        ← {SITE.name}
      </Link>
      <h1 className="mt-6 text-2xl font-medium">{tool.name}</h1>
      <p className="mt-1 text-muted-foreground">{tool.description}</p>
      {tool.server && (
        <p className="mt-4 border border-foreground p-3 text-sm">
          This tool runs on our server. Your file is uploaded, processed, and deleted right after. Other tools on this site never upload anything.
        </p>
      )}
      <div className="mt-8" />
      <View />
    </main>
  );
}
