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


async def run(cmd: list[str], failure: str) -> subprocess.CompletedProcess:
    try:
        return await asyncio.to_thread(subprocess.run, cmd, check=True, timeout=JOB_TIMEOUT, capture_output=True)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "That file took too long to process.")
    except subprocess.CalledProcessError:
        raise HTTPException(422, failure)


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
