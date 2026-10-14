@echo off
:: ==============================================================================
:: INCTL Wash ERP - Windows Local PC 1-Click Starter
:: Runs offline or LAN connected, with SQLite & Google Drive Free 15GB Cloud Sync
:: ==============================================================================

title INCTL Wash ERP - Local Host Engine
color 0A

echo ==========================================================
echo    🧺 INCTL Wash ERP - Local PC Server Launcher
echo ==========================================================

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer.
    echo Please download and install Node.js (LTS version) from https://nodejs.org/
    pause
    exit /b
)

:: Create data directory if not exists
if not exist "data" mkdir data
if not exist "data\gdrive_backups" mkdir data\gdrive_backups

:: Set Environment Variables
set PORT=3000
set DATABASE_MODE=local
set LOCAL_DB_PATH=./data/erp_database.sqlite

echo [*] Starting Local ERP Server on port 3000...
echo [*] Local Database File: .\data\erp_database.sqlite
echo [*] Google Drive 15GB Cloud Sync Folder: .\data\gdrive_backups

:: Open default browser after 3 seconds in background
start "" cmd /c "timeout /t 3 >nul && start http://localhost:3000"

:: Start Server
npm run dev
pause
