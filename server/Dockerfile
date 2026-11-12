FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ghostscript tesseract-ocr tesseract-ocr-eng \
    tesseract-ocr-hin tesseract-ocr-spa tesseract-ocr-fra tesseract-ocr-deu \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN useradd --system --no-create-home app
USER app
ENV OMP_THREAD_LIMIT=1
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
