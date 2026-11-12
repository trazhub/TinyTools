import type { NextConfig } from "next";

/**
 * TinyTools is a fully static site: every tool runs in the browser, so there is
 * no server runtime. `output: "export"` writes plain HTML/JS/CSS to `out/`.
 *
 * On GitHub Pages a project site lives under /<repo>/, so the deploy workflow
 * sets NEXT_PUBLIC_BASE_PATH=/<repo>. Locally it is empty and the site is at /.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true, // /word-counter/index.html, which GitHub Pages serves without rewrites
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
