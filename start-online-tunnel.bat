@echo off
:: ==============================================================================
:: INCTL Wash ERP - Windows 1-Click Online Public Tunnel
:: Access ERP From Anywhere In The World (Mobile, Laptop, Home, Buyer Office)
:: 100% FREE - No Domain, No Static IP, No Port Forwarding Required
:: ==============================================================================

title INCTL Wash ERP - Global Online Launcher
color 0B

echo ==============================================================================
echo    🌐 INCTL Wash ERP - Global 24/7 Online Public Access Launcher
echo ==============================================================================
echo [*] Free Cloud Database + Global Remote Access Mode
echo [*] Factory operators and remote managers can access from anywhere.
echo ==============================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer.
    echo Please install Node.js (v18 or v20 LTS) from https://nodejs.org/
    pause
    exit /b
)

:: 2. Ensure data folders exist
if not exist "data" mkdir data
if not exist "data\gdrive_backups" mkdir data\gdrive_backups

:: 3. Set Environment
set PORT=3000
set DATABASE_MODE=local
set LOCAL_DB_PATH=./data/erp_database.sqlite

:: 4. Start Local ERP Server in a background window
echo [*] Starting INCTL Wash ERP Server on port 3000...
start "INCTL Wash ERP Server" cmd /k "npm run dev"

:: 5. Check or Download Cloudflare Tunnel (cloudflared.exe)
if not exist "cloudflared.exe" (
    where cloudflared >nul 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [INFO] Cloudflare Tunnel binary (cloudflared.exe) not found.
        echo [INFO] Downloading official free Cloudflare Tunnel executable (one-time download, ~20MB)...
        curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o cloudflared.exe
        if not exist "cloudflared.exe" (
            echo [WARNING] Automatic download failed. You can manually download from:
            echo https://github.com/cloudflare/cloudflared/releases
            echo.
            echo The local ERP is still running at http://localhost:3000
            pause
            exit /b
        )
        echo [SUCCESS] Cloudflare Tunnel downloaded successfully!
    )
)

echo.
echo ==============================================================================
echo [INFO] Creating 100% FREE Secure Public HTTPS Tunnel for your ERP...
echo [INFO] Please wait 5-10 seconds for Cloudflare to generate your free URL...
echo ==============================================================================
echo.
echo Your public URL will look like: https://[random-name].trycloudflare.com
echo Copy that link and open it on your phone, tablet, or send to factory managers!
echo.

:: Run Cloudflare Tunnel
if exist "cloudflared.exe" (
    .\cloudflared.exe tunnel --url http://localhost:3000
) else (
    cloudflared tunnel --url http://localhost:3000
)

pause
