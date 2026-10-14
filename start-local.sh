#!/bin/bash
# ==============================================================================
# INCTL Wash ERP - macOS / Linux Local PC Starter
# ==============================================================================

set -e

mkdir -p ./data
mkdir -p ./data/gdrive_backups

export PORT=3000
export DATABASE_MODE=local
export LOCAL_DB_PATH=./data/erp_database.sqlite

echo "=========================================================="
echo "   🧺 Starting INCTL Wash ERP on Local Host               "
echo "=========================================================="

# Determine local IP
if command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
else
    LOCAL_IP="127.0.0.1"
fi

echo "📍 Local Web:       http://localhost:3000"
echo "🌐 Factory Network: http://${LOCAL_IP}:3000"
echo ""

# Attempt to open browser
if which xdg-open > /dev/null; then
  (sleep 2 && xdg-open "http://localhost:3000") &
elif which open > /dev/null; then
  (sleep 2 && open "http://localhost:3000") &
fi

npm run dev
