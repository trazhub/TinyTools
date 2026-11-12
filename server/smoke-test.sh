#!/usr/bin/env bash
# Checks the TinyTools server end to end.  Usage:  bash server/smoke-test.sh [base-url]
# Default base URL is the public address. Run it from the repo root.
set -u
# The server allows 10 requests a minute per client, so the checks below pause once to stay under that.
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
echo "(pausing 62s so the rate limit resets)"; sleep 62
# protect, then unlock with the right and wrong password
code=$(curl -s -m 60 -o /tmp/smoke-prot.pdf -w '%{http_code}' -F file=@samples/ocr-test.pdf -F password=abcd1234 "$BASE/protect")
check "protect pdf" "200" "$code"
check "unlock wrong password" "Could not unlock" "$(curl -s -m 30 -F file=@/tmp/smoke-prot.pdf -F password=nope "$BASE/unlock")"
check "unlock right password" "200" "$(curl -s -m 30 -o /dev/null -w '%{http_code}' -F file=@/tmp/smoke-prot.pdf -F password=abcd1234 "$BASE/unlock")"
check "repair pdf" "200" "$(curl -s -m 60 -o /dev/null -w '%{http_code}' -F file=@samples/ocr-test.pdf "$BASE/repair")"
check "ocr to searchable pdf" "200" "$(curl -s -m 120 -o /dev/null -w '%{http_code}' -F file=@samples/ocr-test.pdf "$BASE/ocr-pdf")"
rm -f /tmp/smoke-prot.pdf
printf 'not a real image' > /tmp/fake.png
check "rejects fake png"  "not supported"    "$(curl -s -m 15 -F file=@/tmp/fake.png "$BASE/ocr")"
rm -f /tmp/fake.png

echo; echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
