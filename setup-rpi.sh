#!/bin/bash
# ==============================================================================
# INCTL Wash ERP - Raspberry Pi (RPi) Auto-Setup & 24/7 Hosting Script
# Supports: Raspberry Pi 3, 4, 5 & Zero 2 W (Debian / Raspberry Pi OS)
# Free 15GB Cloud Backup: Compatible with Google Drive via rclone
# ==============================================================================

set -e

echo "=========================================================="
echo "   🧺 INCTL Wash ERP - Raspberry Pi Setup & 24/7 Server   "
echo "=========================================================="

# 1. Update OS packages
echo "[1/6] 🔄 Updating system packages..."
sudo apt-get update -y

# 2. Check and Install Node.js 20 LTS if not present
if ! command -v node &> /dev/null; then
    echo "[2/6] 📦 Installing Node.js (v20 LTS)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[2/6] ✅ Node.js is already installed: $(node -v)"
fi

# 3. Install PM2 for 24/7 background process & auto-reboot on power outage
echo "[3/6] ⚡ Installing PM2 Process Manager..."
sudo npm install -g pm2

# 4. Install ERP dependencies
echo "[4/6] 📥 Installing ERP applet dependencies..."
npm install

# 5. Create local data directory for offline SQLite persistence
echo "[5/6] 📁 Initializing local database directory..."
mkdir -p ./data
mkdir -p ./data/gdrive_backups

# 6. Configure environment
export PORT=3000
export DATABASE_MODE=local
export LOCAL_DB_PATH=./data/erp_database.sqlite

# Start with PM2
echo "[6/6] 🚀 Launching INCTL Wash ERP with PM2..."
pm2 delete inctl-wash-erp 2>/dev/null || true
pm2 start server.ts --name inctl-wash-erp --interpreter ./node_modules/.bin/tsx --env DATABASE_MODE=local
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

# Detect Local IP Address
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================================="
echo "   🎉 INCTL Wash ERP is successfully running on your RPi! "
echo "=========================================================="
echo "📍 Local Access on RPi:       http://localhost:3000"
echo "🌐 Factory Network (Wi-Fi):  http://${LOCAL_IP}:3000"
echo ""
echo "🌍 24/7 Global Online Access (Anywhere from Mobile/Laptop):"
echo "   Run ./start-online-tunnel.sh to get a 100% FREE public HTTPS link"
echo "   (e.g., https://your-rpi.trycloudflare.com) with zero router config!"
echo ""
echo "📱 Factory operators, sewing floor, and wash plant tablets"
echo "   can open http://${LOCAL_IP}:3000 in any browser."
echo ""
echo "☁️ Google Drive 15GB Cloud Sync Guide:"
echo "   To automatically sync database to your Google Drive:"
echo "   1) Install rclone: sudo apt install rclone"
echo "   2) Configure Google Drive: rclone config"
echo "   3) Sync backup folder: rclone sync ./data/gdrive_backups gdrive:INCTL_ERP_Backups -v"
echo "=========================================================="
