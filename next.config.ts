import type { NextConfig } from "next";

/**
 * TinyTools is a fully static site: every tool runs in the browser, so there is
 * no server runtime to host. `output: "export"` produces plain HTML/JS/CSS in
 * `out/` that works on Cloudflare Pages, Netlify, GitHub Pages, or any static host.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
