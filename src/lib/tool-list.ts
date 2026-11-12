/** The tools on the site. One page each, at /<slug>/. `server: true` means the file is uploaded to our server. */
export const TOOLS: readonly { slug: string; name: string; description: string; server?: true }[] = [
  { slug: "image-scaler", name: "Image scaler", description: "Make an image bigger or smaller by a percentage." },
  { slug: "resolution-changer", name: "Resolution changer", description: "Set an image to an exact width and height." },
  { slug: "image-format-changer", name: "Image format changer", description: "Convert between PNG, JPG and WebP." },
  { slug: "pdf-maker", name: "PDF maker", description: "Turn images into one PDF." },
  { slug: "pdf-to-images", name: "PDF converter", description: "Turn a PDF into PNG or JPG images." },
  { slug: "pdf-compress", name: "PDF compress", description: "Make a PDF smaller. Uploads to our server.", server: true },
  { slug: "ocr", name: "OCR", description: "Get the text out of an image or scanned PDF. Uploads to our server.", server: true },
  { slug: "pdf-dark-mode", name: "PDF black theme", description: "Make a PDF black with white text." },
  { slug: "video-format-changer", name: "Video format changer", description: "Convert video to MP4, WebM, MOV, GIF or MP3." },
  { slug: "3d-viewer", name: "3D viewer", description: "View GLB, glTF, OBJ and STL models." },
  { slug: "word-counter", name: "Word counter", description: "Count words, characters and reading time." },
  { slug: "json-formatter", name: "JSON formatter", description: "Format, minify and validate JSON." },
  { slug: "base64", name: "Base64", description: "Encode and decode Base64." },
  { slug: "password-generator", name: "Password generator", description: "Make a strong random password." },
  { slug: "image-compressor", name: "Image compressor", description: "Make images smaller, in your browser." },
];

export type ToolSlug = string;
