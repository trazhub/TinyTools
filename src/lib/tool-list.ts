/** The tools on the site. One page each, at /<slug>/. */
export const TOOLS = [
  { slug: "word-counter", name: "Word counter", description: "Count words, characters and reading time." },
  { slug: "json-formatter", name: "JSON formatter", description: "Format, minify and validate JSON." },
  { slug: "base64", name: "Base64", description: "Encode and decode Base64." },
  { slug: "password-generator", name: "Password generator", description: "Make a strong random password." },
  { slug: "image-compressor", name: "Image compressor", description: "Make images smaller, in your browser." },
] as const;

export type ToolSlug = (typeof TOOLS)[number]["slug"];
