#!/bin/bash
# Start cloudflared tunnel for voice-kai-channel on port 3005
# Usage: ./start-tunnel.sh

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$DIR/tunnel.log"

echo "Starting Cloudflare tunnel for :3005..."
"$DIR/cloudflared" tunnel --url http://localhost:3005 --logfile "$LOG" --metrics 127.0.0.1:20242 &

sleep 6

if [ -f "$LOG" ]; then
  URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$LOG" | head -1)
  if [ -n "$URL" ]; then
    echo "✅ Tunnel running at: $URL"
    echo "Add to iOS home screen: $URL/channel"
  else
    echo "Waiting for URL..."
    tail -f "$LOG" | while read line; do
      echo "$line" | grep -o 'https://[^ ]*\.trycloudflare\.com' && break
    done
  fi
fi
