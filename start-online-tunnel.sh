#!/bin/bash
# ==============================================================================
# INCTL Wash ERP - Linux & Raspberry Pi 1-Click Online Public Tunnel
# Access ERP From Anywhere In The World (Mobile, Laptop, Home, Buyer Office)
# 100% FREE - No Domain, No Static IP, No Port Forwarding Required
# ==============================================================================

set -e

echo "=============================================================================="
echo "   🌐 INCTL Wash ERP - 24/7 Global Online Public Access Launcher (RPi/Linux)  "
echo "=============================================================================="

# 1. Ensure data directories exist
mkdir -p ./data
mkdir -p ./data/gdrive_backups

# 2. Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please run ./setup-rpi.sh first."
    exit 1
fi

# 3. Check / Install cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "📦 cloudflared is not installed. Detecting system architecture..."
    ARCH=$(uname -m)
    if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    elif [[ "$ARCH" == "armv7l" || "$ARCH" == "armhf" ]]; then
        DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
    else
        DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    fi

    echo "⬇️ Downloading official Cloudflare Tunnel binary for $ARCH..."
    sudo curl -sL "$DOWNLOAD_URL" -o /usr/local/bin/cloudflared
    sudo chmod +x /usr/local/bin/cloudflared
    echo "✅ cloudflared installed successfully!"
fi

# 4. Check if ERP is already running on port 3000
if ! curl -s http://localhost:3000/api/auth/me >/dev/null 2>&1; then
    echo "🚀 Starting INCTL Wash ERP in background via PM2 or Node..."
    if command -v pm2 &> /dev/null; then
        pm2 start server.ts --name inctl-wash-erp --interpreter ./node_modules/.bin/tsx --env DATABASE_MODE=local || true
    else
        npx tsx server.ts &
        sleep 3
    fi
fi

echo ""
echo "=============================================================================="
echo "⚡ Starting 100% FREE Secure Public HTTPS Tunnel for INCTL Wash ERP..."
echo "=============================================================================="
echo "Look for the link ending in: .trycloudflare.com"
echo "Open that link from any phone or remote PC to enter data and view factory KPIs!"
echo "=============================================================================="
echo ""

cloudflared tunnel --url http://localhost:3000
