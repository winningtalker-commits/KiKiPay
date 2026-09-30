#!/usr/bin/env bash
# KiKiPay demo-video pipeline — one command, run after the relay wallet is funded.
#
#   1. waits until the preprod wallet holds tNIGHT (fund at the faucet first)
#   2. registers NIGHT for DUST + waits for DUST (fees)
#   3. starts the tx-relay (mock wallet backend)
#   4. records the live dApp with scripts/demo-driver.mjs
#   5. converts the capture to MP4
#
# Usage: bash scripts/run-demo.sh [base-url] [out.mp4]
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${1:-https://kikipay.vercel.app}"
OUT_MP4="${2:-kikipay-demo.mp4}"
RAW="/tmp/demo-raw.webm"

echo "── [1/5] funding check + DUST registration ─────────────────────────"
# The public RPC drops websockets under load; the first sync can die mid-way.
# Retry up to 5 times — each attempt restores whatever state was persisted.
for attempt in 1 2 3 4 5; do
  # Cap each attempt at 10 min: a hung sync must not block the pipeline.
  if NODE_OPTIONS="--max-old-space-size=8192" timeout 600 npx tsx scripts/fund-demo-wallet.ts; then
    break
  fi
  echo "[pipeline] fund attempt $attempt failed — retrying in 15s…"
  sleep 15
  [ "$attempt" = 5 ] && { echo "[pipeline] funding failed 5× — aborting"; exit 1; }
done

echo "── [2/5] proof server ───────────────────────────────────────────────"
docker compose up -d proof-server
for i in $(seq 1 30); do
  if curl -sf -m 3 http://127.0.0.1:6300/ >/dev/null 2>&1; then break; fi
  sleep 2
done
echo "proof server up"

echo "── [3/5] starting tx-relay (wallet sync takes a few minutes) ────────"
NODE_OPTIONS="--max-old-space-size=8192" npx tsx scripts/tx-relay.ts > /tmp/relay.log 2>&1 &
RELAY_PID=$!
trap 'kill $RELAY_PID 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -m 2 http://127.0.0.1:8787/health 2>/dev/null | grep -q '"ready":true'; then
    echo "relay ready after ~$((i * 5))s"
    break
  fi
  sleep 5
done
if ! curl -sf http://127.0.0.1:8787/health 2>/dev/null | grep -q '"ready":true'; then
  echo "relay did not become ready — see /tmp/relay.log"; exit 1
fi

echo "── [4/5] recording the demo ─────────────────────────────────────────"
xvfb-run -a node scripts/demo-driver.mjs "$BASE_URL" "$RAW"

echo "── [5/5] converting to MP4 ──────────────────────────────────────────"
VID=$(ls -t /tmp/demo-video/*.webm 2>/dev/null | head -1)
[ -f "$VID" ] || { echo "no video captured"; exit 1; }
/home/codespace/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux -y -i "$VID" \
  -c:v libx264 -pix_fmt yuv420p -crf 23 -preset medium "$OUT_MP4" 2>/dev/null \
  || ffmpeg -y -i "$VID" -c:v libx264 -pix_fmt yuv420p -crf 23 "$OUT_MP4"

echo "DONE → $OUT_MP4"
