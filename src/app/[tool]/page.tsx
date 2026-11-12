import type { ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOLS, type ToolSlug } from "@/lib/tool-list";
import { SITE, absoluteUrl } from "@/lib/site";
import WordCounter from "@/os/apps/utilities/word-counter";
import JsonFormatter from "@/os/apps/utilities/json-formatter";
import Base64 from "@/os/apps/utilities/base64-encoder-decoder";
import PasswordGenerator from "@/os/apps/utilities/password-generator";
import ImageCompressor from "@/os/apps/utilities/image-compressor";
import ImageResize from "@/tools/image-resize";
import ImageConverter from "@/tools/image-converter";
import PdfMaker from "@/tools/pdf-maker";
import PdfToImages from "@/tools/pdf-to-images";
import PdfDark from "@/tools/pdf-dark";
import VideoConverter from "@/tools/video-converter";
import Viewer3D from "@/tools/viewer-3d";
import PdfCompress from "@/tools/pdf-compress";
import Ocr from "@/tools/ocr";
import ServerPdf from "@/tools/server-pdf";
import PdfEdit from "@/tools/pdf-edit";
import PdfMerge from "@/tools/pdf-merge";
import PdfSplit from "@/tools/pdf-split";
import PdfOrganize from "@/tools/pdf-organize";
import PdfPlace from "@/tools/pdf-place";
import PdfRedact from "@/tools/pdf-redact";
import PdfForms from "@/tools/pdf-forms";
import PdfCompare from "@/tools/pdf-compare";

const VIEWS: Record<ToolSlug, ComponentType> = {
  "pdf-compress": PdfCompress,
  ocr: Ocr,
  "unlock-pdf": () => <ServerPdf kind="unlock-pdf" />,
  "protect-pdf": () => <ServerPdf kind="protect-pdf" />,
  "repair-pdf": () => <ServerPdf kind="repair-pdf" />,
  "ocr-pdf": () => <ServerPdf kind="ocr-pdf" />,
  "merge-pdf": PdfMerge,
  "sign-pdf": () => <PdfPlace mode="sign" />,
  "edit-pdf": () => <PdfPlace mode="edit" />,
  "redact-pdf": PdfRedact,
  "fill-pdf-form": PdfForms,
  "compare-pdf": PdfCompare,
  "scan-to-pdf": () => <PdfMaker scan />,
  "split-pdf": PdfSplit,
  "organize-pdf": PdfOrganize,
  "remove-pages": () => <PdfEdit kind="remove-pages" />,
  "extract-pages": () => <PdfEdit kind="extract-pages" />,
  "rotate-pdf": () => <PdfEdit kind="rotate-pdf" />,
  "page-numbers": () => <PdfEdit kind="page-numbers" />,
  "watermark-pdf": () => <PdfEdit kind="watermark-pdf" />,
  "crop-pdf": () => <PdfEdit kind="crop-pdf" />,
  "word-counter": WordCounter,
  "json-formatter": JsonFormatter,
  base64: Base64,
  "password-generator": PasswordGenerator,
  "image-compressor": ImageCompressor,
  "image-scaler": () => <ImageResize mode="scale" />,
  "resolution-changer": () => <ImageResize mode="resolution" />,
  "image-format-changer": ImageConverter,
  "pdf-maker": PdfMaker,
  "pdf-to-images": PdfToImages,
  "pdf-dark-mode": PdfDark,
  "video-format-changer": VideoConverter,
  "3d-viewer": Viewer3D,
};

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
