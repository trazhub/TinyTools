export const GROUPS = ["PDF", "Images", "Video, audio and 3D", "Text", "Developer", "Everyday"] as const;
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
  // PDF: sign, review
  { slug: "sign-pdf", name: "Sign PDF", description: "Draw, type or add your signature.", group: "PDF" },
  { slug: "edit-pdf", name: "Edit PDF", description: "Add text and images to a page.", group: "PDF" },
  { slug: "fill-pdf-form", name: "Fill PDF form", description: "Fill in a PDF with form fields.", group: "PDF" },
  { slug: "redact-pdf", name: "Redact PDF", description: "Black out text for good.", group: "PDF" },
  { slug: "compare-pdf", name: "Compare PDF", description: "See what changed between two PDFs.", group: "PDF" },
  // PDF: convert and optimize
  { slug: "pdf-maker", name: "JPG to PDF", description: "Turn images into one PDF.", group: "PDF" },
  { slug: "scan-to-pdf", name: "Scan to PDF", description: "Photograph pages with your phone camera.", group: "PDF" },
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
  { slug: "crop-image", name: "Crop image", description: "Cut out the part of a picture you want.", group: "Images" },
  { slug: "rotate-image", name: "Rotate and flip image", description: "Turn or mirror a picture.", group: "Images" },
  { slug: "heic-to-jpg", name: "HEIC to JPG", description: "Turn iPhone photos into JPG or PNG.", group: "Images" },
  { slug: "remove-metadata", name: "Remove photo metadata", description: "Strip location and camera data from pictures.", group: "Images" },
  { slug: "image-colors", name: "Pick colours from image", description: "Read any colour and find a picture's main colours.", group: "Images" },
  { slug: "image-compressor", name: "Image compressor", description: "Make images smaller, in your browser.", group: "Images" },
  // Video, audio and 3D
  { slug: "video-format-changer", name: "Video format changer", description: "Convert video to MP4, WebM, MOV, GIF or MP3.", group: "Video, audio and 3D" },
  { slug: "video-thumbnail", name: "Video thumbnail extractor", description: "Save any frame of a video as a picture.", group: "Video, audio and 3D" },
  { slug: "extract-audio", name: "Extract audio from video", description: "Save the sound of a video as MP3, WAV and more.", group: "Video, audio and 3D" },
  { slug: "video-to-gif", name: "Video to GIF", description: "Turn part of a video into an animated GIF.", group: "Video, audio and 3D" },
  { slug: "video-compressor", name: "Video compressor", description: "Make a video file smaller.", group: "Video, audio and 3D" },
  { slug: "video-trim", name: "Trim video", description: "Cut a video to the part you want.", group: "Video, audio and 3D" },
  { slug: "audio-converter", name: "Audio converter", description: "Convert audio to MP3, WAV, OGG, M4A or FLAC.", group: "Video, audio and 3D" },
  { slug: "3d-viewer", name: "3D viewer", description: "View GLB, glTF, OBJ and STL models.", group: "Video, audio and 3D" },
  // Text
  { slug: "word-counter", name: "Word counter", description: "Count words, characters and reading time.", group: "Text" },
  { slug: "case-converter", name: "Case converter", description: "Change case and clean up lines of text.", group: "Text" },
  { slug: "text-diff", name: "Text diff", description: "See what changed between two texts.", group: "Text" },
  { slug: "lorem-ipsum", name: "Lorem ipsum generator", description: "Make placeholder text.", group: "Text" },
  { slug: "markdown-preview", name: "Markdown preview", description: "Write Markdown and see it as you type.", group: "Text" },
  // Developer
  { slug: "json-formatter", name: "JSON formatter", description: "Format, minify and validate JSON.", group: "Developer" },
  { slug: "base64", name: "Base64", description: "Encode and decode Base64.", group: "Developer" },
  { slug: "url-encoder", name: "URL encode and decode", description: "Make text safe for a URL, or read it back.", group: "Developer" },
  { slug: "hash-generator", name: "Hash generator", description: "SHA-256 and more, for text or a file.", group: "Developer" },
  { slug: "uuid-generator", name: "UUID generator", description: "Make random unique IDs.", group: "Developer" },
  { slug: "jwt-decoder", name: "JWT decoder", description: "Read the contents of a JSON Web Token.", group: "Developer" },
  { slug: "regex-tester", name: "Regex tester", description: "Try a regular expression on your text.", group: "Developer" },
  { slug: "timestamp-converter", name: "Timestamp converter", description: "Unix time to a date, and back.", group: "Developer" },
  { slug: "color-converter", name: "Colour converter", description: "HEX, RGB and HSL, with a contrast check.", group: "Developer" },
  { slug: "qr-code", name: "QR code generator", description: "Make a QR code from a link or text.", group: "Developer" },
  { slug: "password-generator", name: "Password generator", description: "Make a strong random password.", group: "Developer" },
  // Everyday
  { slug: "unit-converter", name: "Unit converter", description: "Length, weight, volume, temperature and more.", group: "Everyday" },
  { slug: "percentage-calculator", name: "Percentage calculator", description: "Percent of, percent change and more.", group: "Everyday" },
  { slug: "date-calculator", name: "Date calculator", description: "Days between dates, or work out an age.", group: "Everyday" },
  { slug: "stopwatch-timer", name: "Stopwatch and timer", description: "Time something, or count down.", group: "Everyday" },
];

export type ToolSlug = string;
