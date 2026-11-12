# TinyTools: project summary

Free, ad-free tools that run in the browser. Black and white, one page per tool.
Live site: https://trazhub.github.io/TinyTools/ (GitHub Pages, static export).
61 tools in 6 groups: PDF, Images, Video/audio/3D, Text, Developer, Everyday.

## How it is built

- **Next.js static export** (`output: "export"`), Tailwind, TypeScript. No server code in the site itself.
- **Tool list**: `src/lib/tool-list.ts` (name, group, description, `server: true` for upload tools).
- **Tool pages**: `src/app/[tool]/page.tsx` builds one page per entry. `src/tools/registry.tsx` maps each slug to its component.
- **Tool code**: `src/tools/` (components) and `src/lib/tools/` (pure logic, testable). Five older tools still live in `src/os/apps/utilities/` and are imported from there.
- **Result previews**: `src/tools/result-card.tsx` (`ResultCard`, `ResultList`, `PdfPreview`). Use it for any tool that produces a file.
- **Heavy libraries** load only when a tool runs: pdf-lib, pdf.js, three, heic2any, qrcode, ffmpeg.wasm.
- **Vendor files** (ffmpeg wasm about 30 MB, pdf.js worker) are copied to `public/vendor/` by `scripts/copy-vendor.mjs` before every dev and build. The folder is gitignored.
- `src/os/` is the old pixel-desktop. It is no longer used by any page. Safe to delete, but nothing was deleted.

## Add a tool

1. Write the component in `src/tools/` (put pure logic in `src/lib/tools/` and test it).
2. Add an entry to `src/lib/tool-list.ts`.
3. Add the slug to `VIEWS` in `src/tools/registry.tsx`.
4. Run the checks below.

## Commands

```
npm run dev          # local site (runs the vendor copy first)
npm run typecheck    # or: npx tsc --noEmit
npm run lint
npm run test:node    # logic tests, Node built-in runner (14 groups)
npm run build        # static site into out/
npx serve out        # preview the build
```

`npm run test` (vitest) does not start in this setup, even for a trivial test. Use `test:node`.

## Deploy

- Push to `main`. `.github/workflows/deploy.yml` runs typecheck, lint and build, then publishes to GitHub Pages.
- The workflow sets `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BASE_PATH=/<repo name>`. Locally both are empty.
- Pages settings: Source must be "GitHub Actions".

## Server tools (your VM, uploads)

Compress PDF, Unlock, Protect, Repair, OCR PDF, OCR text. Files are deleted right after the job.

- Code in `server/`: `app.py` (FastAPI), `Dockerfile` (Ghostscript, qpdf, Tesseract), `docker-compose.yml`, `setup.sh`.
- VM: `tiny-vm` on Tailscale. Public address via **Tailscale Funnel**: `https://tiny-vm.tailf8b46c.ts.net` (port 8080 stays private on the VM).
- Limits: 50 MB per file, 120 s per job, 10 requests per minute per client, 2 jobs at once. CORS only allows `https://trazhub.github.io`.
- Update the server: copy changed files to `~/tinytools-server/` on the VM, then `docker compose up -d --build` there.
- Check it: `bash server/smoke-test.sh` (13 checks, pauses 62 s for the rate limit). Sample files are in `samples/`.
- Root (sudo) steps on the VM are done by you. Public SSH is closed; access is through Tailscale SSH.
- The API address is in `src/lib/site.ts` (`NEXT_PUBLIC_API_URL` overrides it).

## Gotchas

- **PowerShell for builds with a base path.** In Git Bash, `NEXT_PUBLIC_BASE_PATH=/TinyTools` gets rewritten to a Windows path and the build fails.
- **Do not put apostrophes in Bash heredocs**, and avoid `\\` in inline `node -e` scripts. Write script files instead.
- Some older files use Windows line endings (CRLF). String replacements can miss them.
- Browser tests need a real mouse for drag tools (crop, redact, sign, edit). Script the rest.
- `heic2any` (HEIC to JPG) was only checked with a fake file, not a real iPhone photo.
- Video trim "fast" mode cuts at keyframes, so it can be a second or two off. "Exact" re-encodes.
- No secrets are stored in this repo. Do not put passwords in files or chat.

## Not built, on purpose

YouTube-style downloaders, AI summary and translate, e-signature requests, HTML to PDF (fetches arbitrary web addresses), PDF/A (cannot validate), and Office to/from PDF (needs LibreOffice on the VM; possible later).
