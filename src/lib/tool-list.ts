export const GROUPS = ["PDF", "Images", "Video and 3D", "Text and dev"] as const;
export type Group = (typeof GROUPS)[number];

export interface ToolInfo {
  slug: string;
  name: string;
  description: string;
  group: Group;
  /** The file is uploaded to our server (everything else runs in the browser). */
  server?: true;
}

/** The tools on the site. One page each, at /<slug>/. */
export const TOOLS: readonly ToolInfo[] = [
  // PDF: organize
  { slug: "merge-pdf", name: "Merge PDF", description: "Combine several PDFs into one.", group: "PDF" },
  { slug: "split-pdf", name: "Split PDF", description: "Split a PDF by page or by range.", group: "PDF" },
  { slug: "remove-pages", name: "Remove pages", description: "Delete pages from a PDF.", group: "PDF" },
  { slug: "extract-pages", name: "Extract pages", description: "Keep only the pages you pick.", group: "PDF" },
  { slug: "organize-pdf", name: "Organize PDF", description: "Reorder, rotate and delete pages.", group: "PDF" },
  // PDF: edit
  { slug: "rotate-pdf", name: "Rotate PDF", description: "Turn pages 90°, 180° or 270°.", group: "PDF" },
  { slug: "page-numbers", name: "Page numbers", description: "Add page numbers to a PDF.", group: "PDF" },
  { slug: "watermark-pdf", name: "Watermark PDF", description: "Stamp text across every page.", group: "PDF" },
  { slug: "crop-pdf", name: "Crop PDF", description: "Trim the margins of every page.", group: "PDF" },
  // PDF: sign, security, review
  { slug: "sign-pdf", name: "Sign PDF", description: "Draw, type or add your signature.", group: "PDF" },
  { slug: "edit-pdf", name: "Edit PDF", description: "Add text and images to a page.", group: "PDF" },
  { slug: "fill-pdf-form", name: "Fill PDF form", description: "Fill in a PDF with form fields.", group: "PDF" },
  { slug: "redact-pdf", name: "Redact PDF", description: "Black out text for good.", group: "PDF" },
  { slug: "compare-pdf", name: "Compare PDF", description: "See what changed between two PDFs.", group: "PDF" },
  // PDF: convert and optimize
  { slug: "scan-to-pdf", name: "Scan to PDF", description: "Photograph pages with your phone camera.", group: "PDF" },
  { slug: "pdf-maker", name: "JPG to PDF", description: "Turn images into one PDF.", group: "PDF" },
  { slug: "pdf-to-images", name: "PDF to JPG", description: "Turn a PDF into PNG or JPG images.", group: "PDF" },
  { slug: "pdf-dark-mode", name: "PDF black theme", description: "Make a PDF black with white text.", group: "PDF" },
  { slug: "pdf-compress", name: "Compress PDF", description: "Make a PDF smaller.", group: "PDF", server: true },
  { slug: "unlock-pdf", name: "Unlock PDF", description: "Remove a PDF password.", group: "PDF", server: true },
  { slug: "protect-pdf", name: "Protect PDF", description: "Lock a PDF with a password.", group: "PDF", server: true },
  { slug: "repair-pdf", name: "Repair PDF", description: "Recover a damaged PDF.", group: "PDF", server: true },
  { slug: "ocr-pdf", name: "OCR PDF", description: "Make a scanned PDF searchable.", group: "PDF", server: true },
  { slug: "ocr", name: "OCR text", description: "Get the text out of an image or scanned PDF.", group: "PDF", server: true },
  // Images
  { slug: "image-scaler", name: "Image scaler", description: "Make an image bigger or smaller by a percentage.", group: "Images" },
  { slug: "resolution-changer", name: "Resolution changer", description: "Set an image to an exact width and height.", group: "Images" },
  { slug: "image-format-changer", name: "Image format changer", description: "Convert between PNG, JPG and WebP.", group: "Images" },
  { slug: "image-compressor", name: "Image compressor", description: "Make images smaller, in your browser.", group: "Images" },
  // Video and 3D
  { slug: "video-format-changer", name: "Video format changer", description: "Convert video to MP4, WebM, MOV, GIF or MP3.", group: "Video and 3D" },
  { slug: "3d-viewer", name: "3D viewer", description: "View GLB, glTF, OBJ and STL models.", group: "Video and 3D" },
  // Text and dev
  { slug: "word-counter", name: "Word counter", description: "Count words, characters and reading time.", group: "Text and dev" },
  { slug: "json-formatter", name: "JSON formatter", description: "Format, minify and validate JSON.", group: "Text and dev" },
  { slug: "base64", name: "Base64", description: "Encode and decode Base64.", group: "Text and dev" },
  { slug: "password-generator", name: "Password generator", description: "Make a strong random password.", group: "Text and dev" },
];

export type ToolSlug = string;
