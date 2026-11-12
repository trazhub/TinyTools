"""TinyTools server API. Every job runs in a throwaway temp folder that is deleted afterwards."""
import asyncio
import glob
import os
import shutil
import subprocess
import tempfile
import time
from collections import defaultdict, deque

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

MAX_BYTES = 50 * 1024 * 1024
JOB_TIMEOUT = 120          # seconds, per external command
RATE_LIMIT = 10            # requests per client per minute
MAX_PARALLEL_JOBS = 2
MAX_OCR_PAGES = 15

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "https://trazhub.github.io")],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

jobs = asyncio.Semaphore(MAX_PARALLEL_JOBS)
hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def rate_limit(request: Request) -> None:
    now = time.monotonic()
    q = hits[client_ip(request)]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(429, "Too many requests. Wait a minute and try again.")
    q.append(now)


def sniff(head: bytes) -> str | None:
    """Identify the file by its first bytes (never trust the name or the browser's claim)."""
    if head.startswith(b"%PDF-"):
        return "pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    return None


async def save_upload(file: UploadFile, folder: str, allowed: set[str]) -> tuple[str, str]:
    """Save the upload (size-capped) and return (path, kind). Only the allowed kinds are accepted."""
    tmp = os.path.join(folder, "upload")
    size = 0
    with open(tmp, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                raise HTTPException(413, "That file is over 50 MB.")
            out.write(chunk)
    with open(tmp, "rb") as f:
        kind = sniff(f.read(16))
    if kind not in allowed:
        raise HTTPException(400, "That file type is not supported here.")
    path = os.path.join(folder, f"in.{kind}")
    os.rename(tmp, path)
    return path, kind


async def run(cmd: list[str], failure: str, ok: tuple[int, ...] = (0,)) -> subprocess.CompletedProcess:
    try:
        done = await asyncio.to_thread(subprocess.run, cmd, timeout=JOB_TIMEOUT, capture_output=True)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "That file took too long to process.")
    if done.returncode not in ok:
        raise HTTPException(422, failure)
    return done


@app.get("/health")
def health():
    return {"ok": True}


LEVELS = {"screen": "/screen", "ebook": "/ebook", "printer": "/printer"}


@app.post("/compress")
async def compress(request: Request, file: UploadFile = File(...), level: str = Form("ebook")):
    rate_limit(request)
    if level not in LEVELS:
        raise HTTPException(400, "Unknown level.")
    folder = tempfile.mkdtemp(prefix="job-")
    cleanup = BackgroundTask(shutil.rmtree, folder, ignore_errors=True)
    try:
        src, _ = await save_upload(file, folder, {"pdf"})
        out = os.path.join(folder, "out.pdf")
        async with jobs:
            await run(
                ["gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS={LEVELS[level]}",
                 "-dNOPAUSE", "-dQUIET", "-dBATCH", "-dSAFER", f"-sOutputFile={out}", src],
                "That PDF could not be processed. It may be damaged or protected.",
            )
        # Never return something bigger than what was uploaded.
        result = out if os.path.getsize(out) < os.path.getsize(src) else src
        return FileResponse(result, media_type="application/pdf", filename="compressed.pdf", background=cleanup)
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise


LANGS = {"eng", "hin", "spa", "fra", "deu"}


@app.post("/ocr")
async def ocr(request: Request, file: UploadFile = File(...), lang: str = Form("eng")):
    """Read text out of an image (PNG/JPG) or a scanned PDF."""
    rate_limit(request)
    if lang not in LANGS:
        raise HTTPException(400, "Unknown language.")
    folder = tempfile.mkdtemp(prefix="job-")
    try:
        src, kind = await save_upload(file, folder, {"pdf", "png", "jpg"})
        async with jobs:
            if kind == "pdf":
                # Draw each page to an image first (the first MAX_OCR_PAGES only).
                pattern = os.path.join(folder, "page-%03d.png")
                await run(
                    ["gs", "-sDEVICE=png16m", "-r200", "-dNOPAUSE", "-dQUIET", "-dBATCH", "-dSAFER",
                     f"-dLastPage={MAX_OCR_PAGES}", f"-sOutputFile={pattern}", src],
                    "That PDF could not be read. It may be damaged or protected.",
                )
                images = sorted(glob.glob(os.path.join(folder, "page-*.png")))
            else:
                images = [src]
            texts = []
            for img in images:
                done = await run(["tesseract", img, "stdout", "-l", lang], "The text could not be read from that file.")
                texts.append(done.stdout.decode("utf-8", errors="replace").strip())
        return {"text": "\n\n".join(t for t in texts if t), "pages": len(images)}
    finally:
        shutil.rmtree(folder, ignore_errors=True)


# ---- qpdf / tesseract based PDF tools ---------------------------------------------------

QPDF_OK = (0, 3)  # 3 = finished with warnings


def has_newline(text: str) -> bool:
    return chr(10) in text or chr(13) in text


def pdf_response(path: str, name: str, cleanup: BackgroundTask) -> FileResponse:
    return FileResponse(path, media_type="application/pdf", filename=name, background=cleanup)


@app.post("/unlock")
async def unlock(request: Request, file: UploadFile = File(...), password: str = Form("")):
    """Remove the password from a PDF. Needs the password if the file asks for one to open."""
    rate_limit(request)
    if len(password) > 128 or has_newline(password):
        raise HTTPException(400, "That password is not valid.")
    folder = tempfile.mkdtemp(prefix="job-")
    cleanup = BackgroundTask(shutil.rmtree, folder, ignore_errors=True)
    try:
        src, _ = await save_upload(file, folder, {"pdf"})
        out = os.path.join(folder, "out.pdf")
        pwfile = os.path.join(folder, "pw")
        with open(pwfile, "w") as f:
            f.write(password)
        async with jobs:
            await run(["qpdf", f"--password-file={pwfile}", "--decrypt", src, out],
                      "Could not unlock that PDF. The password may be wrong, or the file is damaged.", QPDF_OK)
        return pdf_response(out, "unlocked.pdf", cleanup)
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise


@app.post("/protect")
async def protect(request: Request, file: UploadFile = File(...), password: str = Form(...)):
    """Encrypt a PDF (AES-256) so it asks for a password to open."""
    rate_limit(request)
    if not (4 <= len(password) <= 64) or has_newline(password) or password.startswith("@"):
        raise HTTPException(400, "Use a password of 4 to 64 characters that does not start with @.")
    folder = tempfile.mkdtemp(prefix="job-")
    cleanup = BackgroundTask(shutil.rmtree, folder, ignore_errors=True)
    try:
        src, _ = await save_upload(file, folder, {"pdf"})
        out = os.path.join(folder, "out.pdf")
        argfile = os.path.join(folder, "args")
        with open(argfile, "w") as f:  # one argument per line; keeps the password out of the process list
            f.write(chr(10).join(["--encrypt", password, password, "256", "--", src, out]) + chr(10))
        async with jobs:
            await run(["qpdf", f"@{argfile}"], "That PDF could not be protected. It may be damaged or already encrypted.", QPDF_OK)
        return pdf_response(out, "protected.pdf", cleanup)
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise


@app.post("/repair")
async def repair(request: Request, file: UploadFile = File(...)):
    """Rebuild a damaged PDF. Tries qpdf first, then a full rewrite with Ghostscript."""
    rate_limit(request)
    folder = tempfile.mkdtemp(prefix="job-")
    cleanup = BackgroundTask(shutil.rmtree, folder, ignore_errors=True)
    try:
        src, _ = await save_upload(file, folder, {"pdf"})
        out = os.path.join(folder, "out.pdf")
        async with jobs:
            try:
                await run(["qpdf", src, out], "qpdf failed", QPDF_OK)
            except HTTPException:
                rewritten = await run(["gs", "-sDEVICE=pdfwrite", "-dNOPAUSE", "-dQUIET", "-dBATCH", "-dSAFER", f"-sOutputFile={out}", src],
                                      "That PDF could not be repaired. Too much of it is missing.")
                # On unreadable input Ghostscript exits normally but writes an empty page.
                if b"No pages will be processed" in rewritten.stdout + rewritten.stderr:
                    raise HTTPException(422, "That PDF could not be repaired. Nothing could be recovered from it.")
        # A "repaired" file with no pages is a failure, not a success.
        try:
            pages = int((await run(["qpdf", "--show-npages", out], "That PDF could not be repaired.", QPDF_OK)).stdout.strip() or 0)
        except ValueError:
            pages = 0
        if pages < 1:
            raise HTTPException(422, "That PDF could not be repaired. Nothing could be recovered from it.")
        return pdf_response(out, "repaired.pdf", cleanup)
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise


@app.post("/ocr-pdf")
async def ocr_pdf(request: Request, file: UploadFile = File(...), lang: str = Form("eng")):
    """Make a scanned PDF searchable: every page gets an invisible text layer."""
    rate_limit(request)
    if lang not in LANGS:
        raise HTTPException(400, "Unknown language.")
    folder = tempfile.mkdtemp(prefix="job-")
    cleanup = BackgroundTask(shutil.rmtree, folder, ignore_errors=True)
    try:
        src, kind = await save_upload(file, folder, {"pdf", "png", "jpg"})
        async with jobs:
            if kind == "pdf":
                pattern = os.path.join(folder, "page-%03d.png")
                await run(["gs", "-sDEVICE=png16m", "-r200", "-dNOPAUSE", "-dQUIET", "-dBATCH", "-dSAFER",
                           f"-dLastPage={MAX_OCR_PAGES}", f"-sOutputFile={pattern}", src],
                          "That PDF could not be read. It may be damaged or protected.")
                images = sorted(glob.glob(os.path.join(folder, "page-*.png")))
            else:
                images = [src]
            parts = []
            for i, img in enumerate(images):
                base = os.path.join(folder, f"ocr-{i:03d}")
                await run(["tesseract", img, base, "-l", lang, "pdf"], "The text could not be read from that file.")
                parts.append(base + ".pdf")
            out = os.path.join(folder, "out.pdf")
            await run(["qpdf", "--empty", "--pages", *parts, "--", out], "The pages could not be combined.", QPDF_OK)
        return pdf_response(out, "searchable.pdf", cleanup)
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
