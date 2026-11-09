import React, { useState } from "react";
import { 
  Server, Cloud, HardDrive, Download, Copy, Check, Terminal, 
  ExternalLink, ShieldCheck, Zap, RefreshCw, AlertTriangle, 
  Database, Laptop, Smartphone, FileCode, CheckCircle2, ChevronRight,
  Clock, Folder, ArrowRight, Play, Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export default function RecommendedFreeSetupHub() {
  const [activeSubTab, setActiveSubTab] = useState<"option1" | "option2" | "scripts" | "live_dump" | "offline_sync">("option1");
  const [lang, setLang] = useState<"bn" | "en">("bn");

  // Config parameters for interactive script generator
  const [dbUser, setDbUser] = useState("erp_user");
  const [dbPass, setDbPass] = useState("YourStrongPass123");
  const [dbName, setDbName] = useState("erp_db");
  const [gdriveFolder, setGdriveFolder] = useState("GarmentsWashERP");
  const [winBackupPath, setWinBackupPath] = useState("C:\\ERP_Backup");
  const [linuxBackupPath, setLinuxBackupPath] = useState("/var/backups/erp");
  const [oraclePublicIp, setOraclePublicIp] = useState("103.45.67.89");
  const [customDomain, setCustomDomain] = useState("erp.yourwash.com");
  const [tunnelId, setTunnelId] = useState("YOUR-TUNNEL-UUID");

  // Copy state trackers
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportingSql, setExportingSql] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadFile = (content: string, filename: string, type = "text/plain") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  // Generate scripts dynamically
  const windowsBatScript = `@echo off
:: ========================================================
:: INCTL Wash ERP - Windows Hourly Auto Backup to Google Drive
:: Runs via Windows Task Scheduler every 1 hour (0 Taka / Free)
:: ========================================================

set DATE=%date:~-4%-%date:~7,2%-%date:~10,2%_%time:~0,2%-%time:~3,2%
set DATE=%DATE: =0%

if not exist "${winBackupPath}" mkdir "${winBackupPath}"

echo [1/3] Dumping MySQL database: ${dbName}...
"C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysqldump.exe" -u ${dbUser} ${dbPass ? `-p${dbPass}` : ""} ${dbName} > "${winBackupPath}\\erp_%DATE%.sql"

echo [2/3] Syncing backup to Google Drive folder: ${gdriveFolder}...
rclone copyto "${winBackupPath}\\erp_%DATE%.sql" "gdrive:${gdriveFolder}/erp_%DATE%.sql"

echo [3/3] Housekeeping: keeping local copies under 48 hours...
forfiles /p "${winBackupPath}" /s /m *.sql /d -2 /c "cmd /c del @path"

echo Backup completed successfully at %DATE%
`;

  const linuxShellScript = `#!/bin/bash
# ========================================================
# INCTL Wash ERP - Oracle Cloud Hourly Backup to Google Drive
# Crontab: 0 * * * * /usr/local/bin/erp_backup.sh
# ========================================================

DATE=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="${linuxBackupPath}"
mkdir -p $BACKUP_DIR

echo "[$DATE] Starting database dump for ${dbName}..."
mysqldump -u ${dbUser} -p'${dbPass}' ${dbName} > $BACKUP_DIR/erp_$DATE.sql

echo "[$DATE] Transferring dump to Google Drive (gdrive:${gdriveFolder})..."
rclone copyto $BACKUP_DIR/erp_$DATE.sql gdrive:${gdriveFolder}/erp_$DATE.sql

# Retain last 2 days on local VM, clean older files
find $BACKUP_DIR -type f -mtime +2 -delete

# Retain last 30 days on Google Drive (clean files older than 30 days)
rclone delete gdrive:${gdriveFolder} --min-age 30d

echo "[$DATE] Hourly Backup completed successfully" >> /var/log/erp_backup.log
`;

  const windowsSchedulerCmd = `schtasks /create /tn "ERP Hourly Backup" /tr "${winBackupPath}\\backup.bat" /sc hourly /mo 1 /f`;

  const nginxConf = `server {
    listen 80;
    server_name ${customDomain} erp.${oraclePublicIp}.sslip.io;
    root /var/www/erp/public;
    index index.php index.html;

    client_max_body_size 50M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Proxy to Node.js backend if using Node / Vite fullstack:
    # location /api {
    #     proxy_pass http://localhost:3000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    # }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}`;

  const cloudflaredConfig = `tunnel: ${tunnelId}
credentials-file: C:\\Users\\User\\.cloudflared\\${tunnelId}.json

ingress:
  - hostname: ${customDomain}
    service: http://localhost:3000
  - service: http_status:404
`;

  const mysqlInitSql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}';
GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost';
FLUSH PRIVILEGES;
`;

  const downloadLiveSql = async () => {
    setExportingSql(true);
    try {
      const res = await fetch("/api/backup/export-sql");
      if (!res.ok) throw new Error("Failed to export SQL");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp_db_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Live MySQL Database Dump (.sql) downloaded!");
    } catch (e: any) {
      toast.error(e.message || "Failed to download SQL dump");
    } finally {
      setExportingSql(false);
    }
  };

  const downloadLiveJson = async () => {
    setExportingJson(true);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) throw new Error("Failed to export JSON");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Complete ERP Snapshot (.json) downloaded!");
    } catch (e: any) {
      toast.error(e.message || "Failed to download JSON snapshot");
    } finally {
      setExportingJson(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Value Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-900/40 rounded-3xl p-6 lg:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                  Recommended Free Setup
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                  100% Free Lifetime ($0 / ৳০)
                </span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                Hybrid Cloud + Offline PC + Hourly Drive Backup
              </h2>
              <p className="text-sm text-slate-300 max-w-3xl">
                {lang === "bn" 
                  ? "অফিস পিসিতে ইন্টারনেট না থাকলেও লোকাল XAMPP/MySQL-এ কাজ হবে, ২৪/৭ ওরাকল ক্লাউডে লাইভ দেখা যাবে এবং প্রতি ১ ঘণ্টা পর পর গুগল ড্রাইভে অটো ব্যাকআপ জমা হবে।"
                  : "Works completely offline on Office PC via XAMPP/MySQL, accessible 24/7 online via Oracle Cloud VM, and automatically backs up to Google Drive every hour via rclone."
                }
              </p>
            </div>

            {/* Language & Actions */}
            <div className="flex items-center gap-2 self-start lg:self-center">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-1 flex">
                <button
                  onClick={() => setLang("bn")}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", lang === "bn" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}
                >
                  🇧🇩 বাংলা
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-all", lang === "en" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>
          </div>

          {/* 4 Pillar Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Laptop size={16} />
                <span className="text-[11px] font-black uppercase">1. Offline PC</span>
              </div>
              <p className="text-sm font-bold text-slate-200">XAMPP / Laragon</p>
              <p className="text-[11px] text-slate-400">ইন্টারনেট ছাড়াও শতভাগ সচল</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Cloud size={16} />
                <span className="text-[11px] font-black uppercase">2. 24/7 Cloud VM</span>
              </div>
              <p className="text-sm font-bold text-slate-200">Oracle Always Free</p>
              <p className="text-[11px] text-slate-400">4 OCPU, 24GB RAM, Lifetime $0</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Clock size={16} />
                <span className="text-[11px] font-black uppercase">3. Hourly Backup</span>
              </div>
              <p className="text-sm font-bold text-slate-200">Google Drive 15GB</p>
              <p className="text-[11px] text-slate-400">rclone দিয়ে প্রতি ৬০ মিনিটে অটো সিঙ্ক</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <ShieldCheck size={16} />
                <span className="text-[11px] font-black uppercase">4. Total Monthly</span>
              </div>
              <p className="text-base font-black text-emerald-400">৳০ / $0.00 Month</p>
              <p className="text-[11px] text-slate-400">সব ওপেন সোর্স ও অফিশিয়াল ফ্রি টায়ার</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab("option1")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeSubTab === "option1"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Cloud size={15} />
          👑 Option 1: Oracle Cloud + PC Offline + Drive (Best)
        </button>

        <button
          onClick={() => setActiveSubTab("option2")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeSubTab === "option2"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Server size={15} />
          Option 2: PC Server + Cloudflare Tunnel
        </button>

        <button
          onClick={() => setActiveSubTab("scripts")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeSubTab === "scripts"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Terminal size={15} />
          ⚡ 1-Click Script & Batch Generator
        </button>

        <button
          onClick={() => setActiveSubTab("live_dump")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeSubTab === "live_dump"
              ? "bg-blue-600 text-white shadow-md shadow-blue-100"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Database size={15} />
          📥 Live SQL Database Dump & Restore
        </button>

        <button
          onClick={() => setActiveSubTab("offline_sync")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeSubTab === "offline_sync"
              ? "bg-amber-600 text-white shadow-md shadow-amber-100"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <RefreshCw size={15} />
          🔄 Offline Working & Sync Rules
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: OPTION 1 (ORACLE CLOUD + PC OFFLINE + DRIVE BACKUP)            */}
      {/* ========================================================================= */}
      {activeSubTab === "option1" && (
        <div className="space-y-6">
          <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Zap size={22} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">
                কেন Option 1 ফ্যাক্টরির জন্য সবচেয়ে সেরা (The Best Architecture)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                এটি ২৪/৭ লাইভ ক্লাউড হোস্টিং নিশ্চিত করে। ফ্যাক্টরির কম্পিউটার বন্ধ থাকলেও বা বিদ্যুৎ চলে গেলেও আপনি যেকোনো জায়গা থেকে ফোন বা ল্যাপটপে লাইভ স্ট্যাটাস দেখতে পারবেন। আবার ফ্যাক্টরির ভেতরে অফিস পিসি দিয়ে ইন্টারনেট ছাড়াও অফলাইনে দ্রুত কাজ করা যাবে।
              </p>
            </div>
          </div>

          {/* 4 Step Sequential Process */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Part A */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 bg-indigo-100 text-indigo-700 font-black text-xs rounded-lg flex items-center justify-center">
                    A
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Part A: Oracle Cloud VM তৈরি</h4>
                </div>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Lifetime Free
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <p>1. <a href="https://cloud.oracle.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">cloud.oracle.com</a>-এ Always Free একাউন্ট তৈরি করুন।</p>
                <p>2. <strong>Compute &gt; Instances &gt; Create Instance</strong> নির্বাচন করুন।</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px]">
                  <p><strong className="text-slate-800">Image:</strong> Canonical Ubuntu 24.04 ARM</p>
                  <p><strong className="text-slate-800">Shape:</strong> VM.Standard.A1.Flex (4 OCPU, 24 GB RAM)</p>
                  <p><strong className="text-slate-800">Networking:</strong> VCN তৈরি করে Port 22, 80, 443 ওপেন করুন (0.0.0.0/0)</p>
                </div>
                <p>3. SSH কি ডাউনলোড করে টার্মিনালে কানেক্ট করুন:</p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                    ssh ubuntu@{oraclePublicIp}
                  </pre>
                  <button
                    onClick={() => handleCopy(`ssh ubuntu@${oraclePublicIp}`, "ssh_cmd", "SSH Command")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "ssh_cmd" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Part B */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 bg-indigo-100 text-indigo-700 font-black text-xs rounded-lg flex items-center justify-center">
                    B
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Part B: সার্ভারে Nginx + MySQL + ERP সেটআপ</h4>
                </div>
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Stack Install
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <p>1. সার্ভারে প্রয়োজনীয় প্যাকেজ ইন্সটল করুন:</p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`sudo apt update && sudo apt upgrade -y
sudo apt install nginx mysql-server nodejs npm php-fpm php-mysql git unzip certbot python3-certbot-nginx -y
sudo systemctl enable nginx mysql`}
                  </pre>
                  <button
                    onClick={() => handleCopy(`sudo apt update && sudo apt upgrade -y\nsudo apt install nginx mysql-server nodejs npm php-fpm php-mysql git unzip certbot python3-certbot-nginx -y\nsudo systemctl enable nginx mysql`, "apt_pkg", "Install command")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "apt_pkg" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <p>2. MySQL ডাটাবেজ ও ইউজার তৈরি করুন:</p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-amber-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{mysqlInitSql}
                  </pre>
                  <button
                    onClick={() => handleCopy(mysqlInitSql, "mysql_sql", "MySQL Init SQL")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "mysql_sql" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Part C */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 bg-indigo-100 text-indigo-700 font-black text-xs rounded-lg flex items-center justify-center">
                    C
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Part C: প্রতি ১ ঘণ্টায় Google Drive-এ অটো ব্যাকআপ</h4>
                </div>
                <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  rclone cron
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <p>1. সার্ভারে rclone ইন্সটল করে গুগল ড্রাইভ কনফিগার করুন:</p>
                <div className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px]">
                  sudo curl https://rclone.org/install.sh | sudo bash
                </div>
                <p>2. ব্যাকআপ স্ক্রিপ্ট <code>/usr/local/bin/erp_backup.sh</code> তৈরি করুন:</p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-cyan-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36">
{linuxShellScript}
                  </pre>
                  <button
                    onClick={() => handleCopy(linuxShellScript, "sh_script", "Linux Script")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "sh_script" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <p>3. ক্রনজবে ১ ঘণ্টা পর পর অটো রান শিডিউল করুন:</p>
                <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <span>0 * * * * /usr/local/bin/erp_backup.sh</span>
                  <button
                    onClick={() => handleCopy("0 * * * * /usr/local/bin/erp_backup.sh", "cron_entry", "Crontab entry")}
                    className="p-1 hover:text-white"
                  >
                    {copiedKey === "cron_entry" ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Part D */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 bg-indigo-100 text-indigo-700 font-black text-xs rounded-lg flex items-center justify-center">
                    D
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Part D: অফিস পিসিতে অফলাইন ব্যাকআপ ও লোকাল ভিউ</h4>
                </div>
                <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Offline PC Sync
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <p>অফিস পিসিতে rclone দিয়ে একই গুগল ড্রাইভ ফোল্ডার সিঙ্ক করুন:</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                  <p className="text-slate-500 font-sans font-bold">Windows Task Scheduler Action:</p>
                  <p className="text-slate-800 bg-white p-2 rounded border border-slate-200">
                    rclone sync "gdrive:{gdriveFolder}" "{winBackupPath}" --max-age 48h
                  </p>
                </div>
                <p>অফলাইনে দেখার জন্য লোকাল XAMPP বা Laragon-এ লেটেস্ট ব্যাকআপ রিস্টোর করুন:</p>
                <div className="p-2.5 bg-slate-900 text-amber-300 rounded-xl font-mono text-[11px]">
                  mysql -u root {dbName} &lt; {winBackupPath}\erp_latest.sql
                </div>
                <p className="text-[11px] text-slate-500">
                  অফিস পিসিতে <code>http://localhost:3000</code> চালু থাকবে। ইন্টারনেট চলে গেলেও ফ্যাক্টরির কর্মীরা রিসিভ, ডেলিভারি ও ওয়াশ ফ্লোর আপডেট দ্রুত দেখতে পারবেন।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: OPTION 2 (PC AS SERVER + CLOUDFLARE TUNNEL)                    */}
      {/* ========================================================================= */}
      {activeSubTab === "option2" && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 border border-slate-700">
              <Server size={22} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-white text-base">
                Option 2: শুধুমাত্র পিসি সার্ভার + Cloudflare Tunnel (১০০% ফ্রি)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                কোনো ক্লাউড ভিএম ছাড়া শুধুমাত্র ফ্যাক্টরির কম্পিউটারকেই মূল সার্ভার বানানো হবে। ক্লাউডফ্লেয়ার টানেল দিয়ে একটি ফ্রি পাবলিক লিংক (যেমন <code>{customDomain}</code>) তৈরি হবে। কোনো রাউটারে পোর্ট ফরওয়ার্ডিং করতে হবে না।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Cloudflare Tunnel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Cloud size={16} className="text-amber-500" />
                  Cloudflare Tunnel সেটআপ কমান্ড
                </h4>
                <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                  No Port Forwarding
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p>1. <code>cloudflared-windows-amd64.exe</code> ডাউনলোড করে <code>C:\cloudflared</code> ফোল্ডারে রাখুন।</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] space-y-1">
                  <p>cd C:\cloudflared</p>
                  <p>cloudflared.exe tunnel login</p>
                  <p>cloudflared.exe tunnel create garments-erp</p>
                </div>
                <p>2. কনফিগ ফাইল <code>config.yml</code> তৈরি করুন:</p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{cloudflaredConfig}
                  </pre>
                  <button
                    onClick={() => handleCopy(cloudflaredConfig, "cf_yml", "Config.yml")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "cf_yml" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <p>3. উইন্ডোজ সার্ভিস হিসেবে ব্যাকগ্রাউন্ডে চালু করুন:</p>
                <div className="p-2.5 bg-slate-900 text-cyan-300 rounded-xl font-mono text-[11px]">
                  cloudflared service install && net start cloudflared
                </div>
              </div>
            </div>

            {/* Step 2: PC 24/7 Rules & Hourly Backup */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" />
                  পিসির জন্য Hourly Auto Backup & 24/7 নিয়ম
                </h4>
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Task Scheduler
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} /> গুরুত্বপূর্ণ সীমাবদ্ধতা:
                  </p>
                  <p className="text-[11px]">
                    পিসি বন্ধ থাকলে বা বিদ্যুৎ চলে গেলে বাইরে থেকে লিংক কাজ করবে না। তাই একটি ছোট ইউপিএস (UPS) ব্যবহার করুন এবং উইন্ডোজ Power Settings-এ গিয়ে <strong>Sleep</strong> বন্ধ রাখুন।
                  </p>
                </div>

                <p>1-ক্লিকে উইন্ডোজ টাস্ক শিডিউলার কমান্ড:</p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
{windowsSchedulerCmd}
                  </pre>
                  <button
                    onClick={() => handleCopy(windowsSchedulerCmd, "sch_cmd", "Task Scheduler Command")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "sch_cmd" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleDownloadFile(windowsBatScript, "backup.bat", "application/x-bat")}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 py-2.5 rounded-xl text-xs font-bold transition-all shadow"
                  >
                    <Download size={14} />
                    Download backup.bat (Ready to Run)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: 1-CLICK SCRIPT GENERATOR & DOWNLOADER                          */}
      {/* ========================================================================= */}
      {activeSubTab === "scripts" && (
        <div className="space-y-6">
          {/* Parameter Tuning Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  কাস্টম প্যারামিটার (আপনার তথ্য বসিয়ে স্ক্রিপ্ট স্বয়ংক্রিয়ভাবে ডাউনলোড করুন)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Auto-populates all scripts</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Database Name</label>
                <input
                  type="text"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">MySQL Username</label>
                <input
                  type="text"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">MySQL Password</label>
                <input
                  type="text"
                  value={dbPass}
                  onChange={(e) => setDbPass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Google Drive Folder</label>
                <input
                  type="text"
                  value={gdriveFolder}
                  onChange={(e) => setGdriveFolder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Windows Backup Folder</label>
                <input
                  type="text"
                  value={winBackupPath}
                  onChange={(e) => setWinBackupPath(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Linux Backup Path</label>
                <input
                  type="text"
                  value={linuxBackupPath}
                  onChange={(e) => setLinuxBackupPath(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Oracle VM Public IP</label>
                <input
                  type="text"
                  value={oraclePublicIp}
                  onChange={(e) => setOraclePublicIp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">ERP Domain / Subdomain</label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4 Interactive Script Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Windows backup.bat */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop size={16} className="text-blue-600" />
                    <h4 className="font-bold text-slate-900 text-sm">backup.bat (Windows Batch File)</h4>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">Task Scheduler</span>
                </div>
                <p className="text-xs text-slate-500">
                  XAMPP বা Laragon MySQL ডাটাবেজ ব্যাকআপ নিয়ে rclone দিয়ে গুগল ড্রাইভে পাঠাবে।
                </p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
{windowsBatScript}
                  </pre>
                  <button
                    onClick={() => handleCopy(windowsBatScript, "bat_copy", "backup.bat")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "bat_copy" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleDownloadFile(windowsBatScript, "backup.bat", "application/x-bat")}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow"
                >
                  <Download size={14} /> Download backup.bat
                </button>
              </div>
            </div>

            {/* Linux erp_backup.sh */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">erp_backup.sh (Linux Shell Script)</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Ubuntu Crontab</span>
                </div>
                <p className="text-xs text-slate-500">
                  Oracle Always Free VM থেকে প্রতি ঘণ্টায় ব্যাকআপ নিয়ে Google Drive-এ পাঠাবে।
                </p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-emerald-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
{linuxShellScript}
                  </pre>
                  <button
                    onClick={() => handleCopy(linuxShellScript, "sh_copy", "erp_backup.sh")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "sh_copy" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleDownloadFile(linuxShellScript, "erp_backup.sh", "application/x-sh")}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow"
                >
                  <Download size={14} /> Download erp_backup.sh
                </button>
              </div>
            </div>

            {/* Nginx Conf */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode size={16} className="text-purple-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Nginx Site Config (/etc/nginx/sites-available/erp)</h4>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">Web Server</span>
                </div>
                <p className="text-xs text-slate-500">
                  Oracle ক্লাউডে ডোমেইন বা sslip.io আইপি দিয়ে পয়েন্ট করার রেডি Nginx কনফিগারেশন।
                </p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-purple-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
{nginxConf}
                  </pre>
                  <button
                    onClick={() => handleCopy(nginxConf, "nginx_copy", "Nginx config")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "nginx_copy" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleDownloadFile(nginxConf, "erp_nginx.conf", "text/plain")}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow"
                >
                  <Download size={14} /> Download erp_nginx.conf
                </button>
              </div>
            </div>

            {/* Cloudflare config.yml */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud size={16} className="text-amber-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Cloudflare config.yml</h4>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">Zero Trust</span>
                </div>
                <p className="text-xs text-slate-500">
                  অফিস পিসিকে পোর্ট ফরওয়ার্ডিং ছাড়াই ফ্রি পাবলিক ডোমেইনে কানেক্ট করার টানেল কনফিগ।
                </p>
                <div className="relative group">
                  <pre className="bg-slate-900 text-amber-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
{cloudflaredConfig}
                  </pre>
                  <button
                    onClick={() => handleCopy(cloudflaredConfig, "cf_copy", "Cloudflare config")}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    {copiedKey === "cf_copy" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleDownloadFile(cloudflaredConfig, "config.yml", "text/yaml")}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow"
                >
                  <Download size={14} /> Download config.yml
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: LIVE SQL DATABASE DUMP & RESTORE                               */}
      {/* ========================================================================= */}
      {activeSubTab === "live_dump" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Database size={18} className="text-indigo-600" />
                  Live Database Dump (MySQL SQL & JSON Export)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  বর্তমান ERP-এর সমস্ত অর্ডার, ডেইলি ওয়াশ লগ, বায়ার ডাটা ব্যাংক ও ইউজারদের এক ক্লিকে ডাউনলোড করুন।
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Live Data Connected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SQL Dump */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                    <FileCode size={16} />
                    <h4>Direct MySQL .SQL Dump File</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    এটি স্ট্যান্ডার্ড MySQL/MariaDB ফাইল। XAMPP, Laragon বা Oracle Cloud MySQL-এ <code>mysql -u root erp_db &lt; erp_db.sql</code> দিয়ে সরাসরি ইমপোর্ট করা যাবে।
                  </p>
                </div>
                <button
                  onClick={downloadLiveSql}
                  disabled={exportingSql}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow disabled:opacity-50"
                >
                  <Download size={14} className={exportingSql ? "animate-bounce" : ""} />
                  {exportingSql ? "Generating SQL Dump..." : "Download erp_db.sql (MySQL Format)"}
                </button>
              </div>

              {/* JSON Dump */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <Database size={16} />
                    <h4>Full ERP JSON Snapshot File</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    সম্পূর্ণ স্ট্রাকচার্ড JSON ব্যাকআপ। এই ERP-এর ব্যাকআপ ম্যানেজার বা অন্য কোনো সিস্টেমে ডাটা রিস্টোর করার জন্য সবচেয়ে উপযুক্ত।
                  </p>
                </div>
                <button
                  onClick={downloadLiveJson}
                  disabled={exportingJson}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow disabled:opacity-50"
                >
                  <Download size={14} className={exportingJson ? "animate-bounce" : ""} />
                  {exportingJson ? "Generating Snapshot..." : "Download Full JSON Snapshot (.json)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: OFFLINE WORKING & SYNC RULES                                   */}
      {/* ========================================================================= */}
      {activeSubTab === "offline_sync" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <RefreshCw size={18} className="text-amber-600" />
              ফ্যাক্টরি অফলাইন মোড ও অটো সিঙ্ক নির্দেশিকা (How Offline PC Sync Works)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ইন্টারনেট সাময়িক বা দীর্ঘক্ষণ বিচ্ছিন্ন থাকলেও প্রোডাকশন যাতে কখনো বন্ধ না হয়।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-black uppercase text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md inline-block">
                ধাপ ১: অফলাইনে কাজ
              </span>
              <h4 className="font-bold text-slate-800 text-sm">লোকাল ব্রাউজার ক্যাশ ও লোকাল DB</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ফ্যাক্টরি পিসিতে ইন্টারনেট না থাকলে ERP স্বয়ংক্রিয়ভাবে লোকাল SQLite / XAMPP MySQL ব্যবহার করে। ওয়াশ রিসিভ, ডেলিভারি এবং কিউসি এন্ট্রি কোনো বাধা ছাড়াই চলতে থাকে।
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-black uppercase text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md inline-block">
                ধাপ ২: নেটওয়ার্ক ডিটেকশন
              </span>
              <h4 className="font-bold text-slate-800 text-sm">স্বয়ংক্রিয় রিকানেক্ট ডিটেকশন</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ব্রাউজার সার্ভিস ওয়ার্কার ও ব্যাকগ্রাউন্ড সিঙ্ক নিয়মিত ক্লাউড সংযোগ পরীক্ষা করে। ইন্টারনেট পাওয়ার সাথে সাথে ব্যাকগ্রাউন্ড সিঙ্ক ট্রিগার হয়।
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-black uppercase text-purple-700 bg-purple-100 px-2.5 py-1 rounded-md inline-block">
                ধাপ ৩: ক্লাউড মার্জ
              </span>
              <h4 className="font-bold text-slate-800 text-sm">First Recv & Last Delivery Rule</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                সিঙ্ক হওয়ার সময় আমাদের কোর ERP রুল বজায় থাকে: পূর্বের কোনো লগ ডিলিট হয় না এবং প্রথম রিসিভ ও শেষ ডেলিভারি লগ অক্ষত রেখে ওরাকল ক্লাউডে ডেটা মার্জ হয়।
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
