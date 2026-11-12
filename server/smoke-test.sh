#!/usr/bin/env bash
# Checks the TinyTools server end to end.  Usage:  bash server/smoke-test.sh [base-url]
# Default base URL is the public address. Run it from the repo root.
set -u
BASE="${1:-https://tiny-vm.tailf8b46c.ts.net}"
ORIGIN="https://trazhub.github.io"
pass=0; fail=0

check() { # name, expected, actual
  if [[ "$3" == *"$2"* ]]; then echo "ok   $1"; pass=$((pass+1)); else echo "FAIL $1 (wanted '$2', got '$3')"; fail=$((fail+1)); fi
}

check "health"            '"ok":true'  "$(curl -s -m 15 "$BASE/health")"
check "cors allows site"  "$ORIGIN"    "$(curl -s -m 15 -D - -o /dev/null -H "Origin: $ORIGIN" "$BASE/health")"
check "ocr png"           "Hello TinyTools OCR 12345" "$(curl -s -m 60 -F file=@samples/ocr-test.png "$BASE/ocr")"
check "ocr pdf"           "Hello TinyTools OCR 12345" "$(curl -s -m 60 -F file=@samples/ocr-test.pdf "$BASE/ocr")"
check "compress pdf"      "200"        "$(curl -s -m 60 -o /dev/null -w '%{http_code}' -F file=@samples/ocr-test.pdf "$BASE/compress")"
check "ocr bad language"  "Unknown language" "$(curl -s -m 15 -F file=@samples/ocr-test.png -F lang=xx "$BASE/ocr")"
check "compress bad level" "Unknown level"   "$(curl -s -m 15 -F file=@samples/ocr-test.pdf -F level=evil "$BASE/compress")"
printf 'not a real image' > /tmp/fake.png
check "rejects fake png"  "not supported"    "$(curl -s -m 15 -F file=@/tmp/fake.png "$BASE/ocr")"
rm -f /tmp/fake.png

echo; echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
