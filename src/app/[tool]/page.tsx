import type { ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOLS, type ToolSlug } from "@/lib/tool-list";
import { SITE } from "@/lib/site";
import WordCounter from "@/os/apps/utilities/word-counter";
import JsonFormatter from "@/os/apps/utilities/json-formatter";
import Base64 from "@/os/apps/utilities/base64-encoder-decoder";
import PasswordGenerator from "@/os/apps/utilities/password-generator";
import ImageCompressor from "@/os/apps/utilities/image-compressor";

const VIEWS: Record<ToolSlug, ComponentType> = {
  "word-counter": WordCounter,
  "json-formatter": JsonFormatter,
  base64: Base64,
  "password-generator": PasswordGenerator,
  "image-compressor": ImageCompressor,
};

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) return {};
  return { title: `${tool.name} — ${SITE.name}`, description: tool.description, alternates: { canonical: `/${tool.slug}/` } };
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) notFound();
  const View = VIEWS[tool.slug];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm">
        ← {SITE.name}
      </Link>
      <h1 className="mt-6 text-2xl font-medium">{tool.name}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{tool.description}</p>
      <View />
    </main>
  );
}
