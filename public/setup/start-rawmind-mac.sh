#!/bin/bash
# RawMind — one-click setup (macOS / Linux)
# Run: bash start-rawmind-mac.sh   (or double-click if your OS allows it)
set -u

MODEL="maanis/rawmind"             # published RawMind model
SITE="https://rawmind.maanis.dev"  # <-- replace with your actual domain
OS="$(uname -s)"

step() { echo -e "\n==> $1"; }
ok()   { echo "    OK: $1"; }
warn() { echo "    ! $1"; }
err()  { echo "    ERROR: $1"; }

echo "====================================="
echo "  RawMind setup for $SITE"
echo "====================================="

# ---------- 1. Ollama installed? ----------
step "Checking for Ollama"
if ! command -v ollama >/dev/null 2>&1; then
  warn "Ollama not found. Installing..."
  if [ "$OS" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      brew install --cask ollama
    else
      open "https://ollama.com/download"
      echo "Install Ollama from the page that just opened, then run this script again."
      exit 1
    fi
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
fi
if ! command -v ollama >/dev/null 2>&1; then
  err "Ollama still not found after install. Open a new terminal and try again."
  exit 1
fi
ok "Ollama is installed"

# ---------- 2. Stop any running instance (avoid stale env vars / port conflicts) ----------
step "Stopping any running Ollama process"
pkill -f "ollama serve" 2>/dev/null
pkill -f "Ollama.app" 2>/dev/null
sleep 1
ok "Cleared"

# ---------- 3. Configure env vars ----------
step "Configuring Ollama to accept connections from $SITE"
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0:11434"
if [ "$OS" = "Darwin" ]; then
  # The macOS Ollama.app (menu bar app) doesn't inherit shell exports —
  # it needs these set via launchctl so the app itself picks them up.
  launchctl setenv OLLAMA_ORIGINS "*"
  launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
fi
ok "Environment configured"

# ---------- 4. Start Ollama server ----------
step "Starting Ollama server"
nohup ollama serve > /tmp/rawmind-ollama.log 2>&1 &
for i in $(seq 1 10); do
  if curl -s -o /dev/null "http://localhost:11434/api/tags"; then
    break
  fi
  sleep 1
done
if ! curl -s -o /dev/null "http://localhost:11434/api/tags"; then
  err "Ollama didn't come up. Check /tmp/rawmind-ollama.log"
  exit 1
fi
ok "Ollama server is running"

# ---------- 5. Pull the model ----------
step "Pulling model: $MODEL (first time may take a while)"
ollama pull "$MODEL"
ok "Model ready"

# ---------- 6. cloudflared installed? ----------
step "Checking for cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
  warn "cloudflared not found. Installing..."
  if [ "$OS" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    brew install cloudflared
  elif [ "$OS" = "Linux" ]; then
    curl -fsSL -o /tmp/cloudflared.deb \
      https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
      && sudo dpkg -i /tmp/cloudflared.deb
  fi
fi
if ! command -v cloudflared >/dev/null 2>&1; then
  err "Could not install cloudflared automatically. Get it from https://github.com/cloudflare/cloudflared/releases and re-run this script."
  exit 1
fi
ok "cloudflared is installed"

# ---------- 7. Start tunnel and capture URL ----------
step "Starting Cloudflare tunnel"
LOGFILE="/tmp/rawmind-tunnel.log"
rm -f "$LOGFILE"
nohup cloudflared tunnel --url http://localhost:11434 > "$LOGFILE" 2>&1 &

TUNNEL_URL=""
for i in $(seq 1 20); do
  sleep 1
  TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOGFILE" | head -n1)
  if [ -n "$TUNNEL_URL" ]; then break; fi
done

if [ -z "$TUNNEL_URL" ]; then
  err "Couldn't read the tunnel URL. Check $LOGFILE, or run manually: cloudflared tunnel --url http://localhost:11434"
  exit 1
fi
ok "Tunnel URL: $TUNNEL_URL"

# ---------- 8. Verify ----------
step "Verifying the tunnel"
VERIFIED=false
for i in $(seq 1 10); do
  if curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL/api/tags" | grep -q 200; then
    VERIFIED=true
    break
  fi
  sleep 2
done

if [ "$VERIFIED" = true ]; then
  ok "Tunnel is working"
else
  err "Tunnel didn't respond with 200 yet — give it a few more seconds and retry the curl command yourself."
fi

if [ "$OS" = "Darwin" ] && command -v pbcopy >/dev/null 2>&1; then
  echo -n "$TUNNEL_URL" | pbcopy
  COPIED=" (copied to clipboard)"
else
  COPIED=""
fi

echo ""
echo "====================================="
echo "  Your RawMind connection URL:"
echo "  $TUNNEL_URL$COPIED"
echo "====================================="
echo ""
echo "On your phone: open $SITE/rawmind/settings, switch to 'Different device',"
echo "paste this URL, and hit Save. Keep this terminal open while you use RawMind —"
echo "closing it stops both the server and the tunnel."