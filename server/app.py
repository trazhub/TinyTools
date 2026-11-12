"""TinyTools server API. Every job runs in a throwaway temp folder that is deleted afterwards."""
import asyncio
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
JOB_TIMEOUT = 120          # seconds
RATE_LIMIT = 10            # requests per client per minute
MAX_PARALLEL_JOBS = 2

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


async def save_upload(file: UploadFile, folder: str) -> str:
    path = os.path.join(folder, "in.pdf")
    size = 0
    with open(path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                raise HTTPException(413, "That file is over 50 MB.")
            out.write(chunk)
    with open(path, "rb") as f:
        if f.read(5) != b"%PDF-":
            raise HTTPException(400, "That file is not a PDF.")
    return path


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
        src = await save_upload(file, folder)
        out = os.path.join(folder, "out.pdf")
        async with jobs:
            try:
                await asyncio.to_thread(
                    subprocess.run,
                    ["gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS={LEVELS[level]}",
                     "-dNOPAUSE", "-dQUIET", "-dBATCH", "-dSAFER", f"-sOutputFile={out}", src],
                    check=True, timeout=JOB_TIMEOUT, capture_output=True,
                )
            except subprocess.TimeoutExpired:
                raise HTTPException(504, "That PDF took too long to process.")
            except subprocess.CalledProcessError:
                raise HTTPException(422, "That PDF could not be processed. It may be damaged or protected.")
        # Never return something bigger than what was uploaded.
        result = out if os.path.getsize(out) < os.path.getsize(src) else src
        return FileResponse(result, media_type="application/pdf", filename="compressed.pdf", background=cleanup)
    except BaseException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
