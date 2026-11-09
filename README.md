# Industrial Garment Washing ERP (RMG)

<p align="center">
  <img src="public/banner.jpg" width="100%" alt="Industrial Garment Washing ERP (RMG) Banner" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);" />
</p>

<p align="center">
  <b>A High-Performance Enterprise ERP System for Garment Washing Plants, Industrial Dyeing, Fabric Tracking (CPL), and Buyer Order Analytics with Multi-Adapter SQL/NoSQL Storage and 100% Free Lifetime Self-Hosted & Cloud Architecture.</b>
</p>

[![Open in Google AI Studio](https://img.shields.io/badge/Open%20in-Google%20AI%20Studio-blue?logo=google&logoColor=white)](https://ai.studio/build)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Version: v3.2.0](https://img.shields.io/badge/Version-v3.2.0-indigo.svg)](https://github.com)
[![Total Monthly Hosting Cost: 0 Taka](https://img.shields.io/badge/Monthly%20Cost-0%20Taka%20%2F%20%240-emerald.svg)](https://cloud.oracle.com)

---

## 📦 Industrial Garment Washing ERP (RMG) Modules
```text
Industrial Garment Washing ERP (RMG) Modules:
├── 🗂️ Order Management (NEXT ERP Plan - Duplicate Prevention & Auto-Mapping)
├── 🧵 Fabrics Tracking CPL (Receive / Delivery / Sub-Factory / WIP in Kg & Pcs)
├── 🧺 Garments Tracking (Wash Floor-wise / Sub-Factory & Batch-Load Tracking)
├── 👥 Buyer Dashboard (All Buyers Consolidated with Sub-Factory & Historical Data)
├── 📊 Reporting & Analytics (Sub-Factory, WIP, Delay, Efficiency & Revenue P&L)
├── 💰 Wash Revenue & Profit/Loss Bar (Role-Gated: Wash MD & Wash Manager Only)
├── ⚡ Sia Decentralized Cloud & Awesome-Selfhosted Storage
├── 💻 OfficeCLI Integration (Command-Line ERP Automation)
├── 🌐 AionUI Global Omni Control (Super Admin Remote Access Worldwide)
└── 🔐 Admin & User Role-Based Access Control (RBAC)
```

---

## 🏆 Recommended Free Setup (100% Free Lifetime Architecture)
> **সর্বমোট মাসিক খরচ: ০ টাকা ($0.00 / মাস)**  
> সব ওপেন সোর্স সফটওয়্যার এবং অফিশিয়াল লাইফটাইম ফ্রি ক্লাউড টায়ার দিয়ে তৈরি।

### 📊 Cost Breakdown (খরচের তালিকা)
| Component | Technology | Monthly Cost |
| :--- | :--- | :--- |
| **Local PC Environment** | XAMPP / Laragon (Apache + MySQL + PHP / Node.js) | **৳০ / $0** (Free Open Source) |
| **Frontend Framework** | React 19 + TypeScript + Vite | **৳০ / $0** (MIT License) |
| **24/7 Cloud Host** | Oracle Cloud Always Free VM (4 OCPU ARM, 24 GB RAM) | **৳০ / $0** (Lifetime Free) |
| **Encrypted Public Access** | Cloudflare Tunnel (`cloudflared`) | **৳০ / $0** (Free Zero-Trust) |
| **Automated Cloud Backup** | Google Drive (15 GB Free Storage) | **৳০ / $0** (Free Google Account) |
| **Backup Automation Tool** | `rclone` + Windows Task Scheduler / Linux Crontab | **৳০ / $0** (Free Open Source) |
| **Total Monthly Cost** | | **৳০ / $0.00 Month** |

---

## 👑 Option 1: Oracle Cloud 24/7 Server + PC Offline Backup + Hourly Drive Backup (Best & Recommended)

এটি ফ্যাক্টরির জন্য সবচেয়ে নিরাপদ ও কার্যকর আর্কিটেকচার। ফ্যাক্টরির কম্পিউটার বন্ধ থাকলেও বা বিদ্যুৎ চলে গেলেও আপনি মোবাইল বা ল্যাপটপ থেকে ২৪/৭ লাইভ ডেটা দেখতে পারবেন। আবার ফ্যাক্টরির ভেতরে ইন্টারনেট না থাকলেও লোকাল পিসিতে কাজ চলবে।

```text
       ┌────────────────────────────────────────────────────────┐
       │     Oracle Cloud Always Free VM (Ubuntu 24.04 ARM)     │
       │    4 OCPU, 24 GB RAM - Main 24/7 Production Server      │
       │           Nginx + MySQL (erp_db) + Node/Laravel        │
       └───────────┬────────────────────────────────┬───────────┘
                   │                                │
        Hourly rclone Sync (0 * * * *)       24/7 Live Web Access
                   ▼                                ▼
       ┌───────────────────────────┐      ┌─────────────────────┐
       │   Google Drive (15 GB)    │      │   Smartphone / PC   │
       │  gdrive:GarmentsWashERP   │      │  erp.yourwash.com   │
       └───────────┬───────────────┘      └─────────────────────┘
                   │
         Hourly rclone Sync
                   ▼
       ┌────────────────────────────────────────────────────────┐
       │             Office Local PC (XAMPP / Laragon)          │
       │   - Works 100% Offline with Local MySQL DB Cache       │
       │   - Auto-syncs to Oracle Cloud when Internet returns   │
       └────────────────────────────────────────────────────────┘
```

### 📌 Step-by-Step Installation Guide (Option 1)

#### Part A: Oracle Cloud VM তৈরি
1. [cloud.oracle.com](https://cloud.oracle.com)-এ গিয়ে একটি **Always Free** অ্যাকাউন্ট খুলুন।
2. **Compute > Instances > Create Instance**-এ ক্লিক করুন:
   - **Image**: Canonical Ubuntu 24.04 ARM
   - **Shape**: `VM.Standard.A1.Flex` (4 OCPU, 24 GB RAM — আজীবন ফ্রি)
   - **SSH Key**: আপনার SSH Public Key আপলোড করুন অথবা নতুন কী ডাউনলোড করে সংরক্ষণ করুন।
   - **Networking**: VCN তৈরি করে Security List / Ingress Rules-এ Port `22`, `80`, `443` ওপেন করে দিন (`0.0.0.0/0`)।
3. পাবলিক আইপি দিয়ে টার্মিনালে কানেক্ট করুন:
   ```bash
   ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
   ```

#### Part B: সার্ভারে Nginx, MySQL ও ERP সেটআপ
1. সিস্টেম আপডেট এবং প্রয়োজনীয় প্যাকেজ ইন্সটল করুন:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install nginx mysql-server nodejs npm php-fpm php-mysql git unzip certbot python3-certbot-nginx -y
   sudo systemctl enable nginx mysql
   ```
2. MySQL ডাটাবেজ ও ইউজার তৈরি করুন:
   ```bash
   sudo mysql
   ```
   ```sql
   CREATE DATABASE IF NOT EXISTS erp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'erp_user'@'localhost' IDENTIFIED BY 'YourStrongPass123';
   GRANT ALL PRIVILEGES ON erp_db.* TO 'erp_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```
3. ERP কোড ক্লোন / আপলোড করে ডিপ্লয় করুন:
   ```bash
   sudo mkdir -p /var/www/erp
   sudo chown -R ubuntu:ubuntu /var/www/erp
   cd /var/www/erp
   # কোড ক্লোন বা rsync দিয়ে ফাইল আপলোড করুন
   npm install
   npm run build
   ```
4. Nginx কনফিগারেশন ফাইল তৈরি করুন (`/etc/nginx/sites-available/erp`):
   ```nginx
   server {
       listen 80;
       server_name erp.yourdomain.com erp.YOUR_ORACLE_IP.sslip.io;
       root /var/www/erp/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. ফ্রি SSL সক্রিয় করুন (Certbot):
   ```bash
   sudo certbot --nginx -d erp.yourdomain.com
   ```

#### Part C: প্রতি ১ ঘণ্টায় Google Drive-এ অটো ব্যাকআপ (rclone + Cron)
1. সার্ভারে `rclone` ইন্সটল করুন:
   ```bash
   sudo curl https://rclone.org/install.sh | sudo bash
   ```
2. গুগল ড্রাইভ রিমোট কনফিগার করুন (`rclone config` চালিয়ে `gdrive` নামে কনফিগার করুন)।
3. ব্যাকআপ স্ক্রিপ্ট তৈরি করুন (`/usr/local/bin/erp_backup.sh`):
   ```bash
   #!/bin/bash
   DATE=$(date +"%Y-%m-%d_%H-%M")
   BACKUP_DIR="/var/backups/erp"
   mkdir -p $BACKUP_DIR
   
   # MySQL Dump
   mysqldump -u erp_user -p'YourStrongPass123' erp_db > $BACKUP_DIR/erp_$DATE.sql
   
   # Sync to Google Drive
   rclone copyto $BACKUP_DIR/erp_$DATE.sql gdrive:GarmentsWashERP/erp_$DATE.sql
   
   # Keep last 2 days on local VM and 30 days on Google Drive
   find $BACKUP_DIR -type f -mtime +2 -delete
   rclone delete gdrive:GarmentsWashERP --min-age 30d
   
   echo "[$DATE] Hourly Backup completed" >> /var/log/erp_backup.log
   ```
   ```bash
   sudo chmod +x /usr/local/bin/erp_backup.sh
   ```
4. ক্রনজবে প্রতি ১ ঘণ্টায় স্বয়ংক্রিয় রান শিডিউল করুন (`crontab -e`):
   ```text
   0 * * * * /usr/local/bin/erp_backup.sh
   ```

#### Part D: অফিস পিসিতে অফলাইন ব্যাকআপ ও লোকাল ভিউ
1. অফিস পিসিতে `rclone` ইন্সটল করে একই Google Drive ফোল্ডার সিঙ্ক করুন।
2. Windows Task Scheduler-এ প্রতি ১ ঘণ্টা পর পর সিঙ্ক টাস্ক দিন:
   ```cmd
   rclone sync "gdrive:GarmentsWashERP" "C:\ERP_Backup" --max-age 48h
   ```
3. ইন্টারনেট না থাকলেও পিসিতে XAMPP / Laragon-এ লেটেস্ট ব্যাকআপ রিস্টোর করে অফলাইনে কাজ করুন:
   ```cmd
   mysql -u root erp_db < C:\ERP_Backup\erp_latest.sql
   ```

---

## 💻 Option 2: শুধুমাত্র পিসি সার্ভার + Cloudflare Tunnel + Hourly Drive Backup

কোনো ক্লাউড ভিএম ছাড়াই শুধুমাত্র আপনার অফিসের কম্পিউটারকে মূল সার্ভার বানিয়ে ফ্রি ক্লাউডফ্লেয়ার টানেলের মাধ্যমে বিশ্বব্যাপী ব্যবহার করার উপায়।

### 📌 Step-by-Step Installation Guide (Option 2)

#### Part A: পিসিতে ERP ও MySQL ইনস্টলেশন
1. পিসিতে **Laragon** বা **XAMPP** ডাউনলোড করে ইন্সটল করুন।
2. MySQL চালু করে `erp_db` ডাটাবেজ তৈরি করুন।
3. প্রজেক্ট ফোল্ডারে টার্মিনাল খুলে ডিপেন্ডেন্সি ইন্সটল ও সার্ভার রান করুন:
   ```bash
   npm install
   npm run build
   npm run dev
   ```
   পিসিতে `http://localhost:3000` এ ERP চলবে।

#### Part B: Cloudflare Tunnel সেটআপ (নো পোর্ট ফরওয়ার্ডিং)
1. [cloudflare.com](https://cloudflare.com)-এ ফ্রি অ্যাকাউন্ট খুলে আপনার ডোমেইন অ্যাড করুন।
2. পিসিতে `cloudflared-windows-amd64.exe` ডাউনলোড করে `C:\cloudflared` ফোল্ডারে রাখুন।
3. কমান্ড প্রম্পটে গিয়ে টানেল তৈরি করুন:
   ```cmd
   cd C:\cloudflared
   cloudflared.exe tunnel login
   cloudflared.exe tunnel create garments-erp
   ```
4. `C:\Users\YourUser\.cloudflared\config.yml` ফাইল তৈরি করুন:
   ```yaml
   tunnel: YOUR-TUNNEL-UUID
   credentials-file: C:\Users\YourUser\.cloudflared\YOUR-TUNNEL-UUID.json

   ingress:
     - hostname: erp.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. ডোমেইন রাউট করুন এবং উইন্ডোজ সার্ভিস চালু করুন:
   ```cmd
   cloudflared.exe tunnel route dns garments-erp erp.yourdomain.com
   cloudflared.exe service install
   net start cloudflared
   ```
   এখন পৃথিবীর যেকোনো জায়গা থেকে `https://erp.yourdomain.com` লিংকে ঢুকে ERP চালানো যাবে।

#### Part C: উইন্ডোজ পিসির জন্য Hourly Auto Backup Script (`backup.bat`)
`C:\ERP_Backup\backup.bat` নামে একটি ফাইল তৈরি করুন:
```bat
@echo off
set DATE=%date:~-4%-%date:~7,2%-%date:~10,2%_%time:~0,2%-%time:~3,2%
set DATE=%DATE: =0%

if not exist "C:\ERP_Backup" mkdir "C:\ERP_Backup"

echo [1/3] Dumping MySQL database...
"C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqldump.exe" -u root erp_db > "C:\ERP_Backup\erp_%DATE%.sql"

echo [2/3] Transferring dump to Google Drive...
rclone copyto "C:\ERP_Backup\erp_%DATE%.sql" "gdrive:GarmentsWashERP/erp_%DATE%.sql"

echo [3/3] Deleting temporary dumps older than 2 days...
forfiles /p "C:\ERP_Backup" /s /m *.sql /d -2 /c "cmd /c del @path"

echo Backup completed at %DATE%
```
Windows Task Scheduler-এ ১-ক্লিকে প্রতি ১ ঘণ্টায় টাস্ক সক্রিয় করতে CMD-তে রান করুন:
```cmd
schtasks /create /tn "ERP Hourly Backup" /tr "C:\ERP_Backup\backup.bat" /sc hourly /mo 1 /f
```

#### Part D: পিসি ২৪/৭ সচল রাখার নিয়মাবলী
* **Power Settings**: Windows Control Panel > Power Options-এ গিয়ে **Sleep** ও **Hibernate** পুরোপুরি বন্ধ (Never) রাখুন।
* **UPS Backup**: একটি ছোট ইউপিএস ব্যবহার করুন যাতে লোডশেডিং হলেও পিসি অন্তত ১০-১৫ মিনিট ব্যাকআপ পায়।
* **Cloudflare Zero Trust Access**: অতিরিক্ত নিরাপত্তার জন্য Cloudflare Access-এ Email OTP লক চালু করুন।

---

## 💰 Wash Revenue & Profit/Loss (P&L) Engine
* **ভূমিকা ও অ্যাক্সেস কন্ট্রোল**:
  * ফাইন্যান্সিয়াল মেট্রিক্স, ওয়াশ রেভিনিউ, প্রতি পিসের খরচ (Cost/Pcs), এবং লাভ-ক্ষতির (Profit & Loss) বিস্তারিত শুধুমাত্র **Wash MD** অথবা **Wash Manager** দেখতে পারেন।
  * সাধারণ ইউজার (Normal Users) এবং ডাটা এন্ট্রি অপারেটরদের (Data Entry Operators) জন্য এই আর্থিক ক্যালকুলেশন পুরোপুরি অদৃশ্য ও সুরক্ষিত রাখা হয়েছে।
* **অ্যালগরিদম**:
  $$\text{Revenue} = \text{Delivered Qty} \times \text{Wash Rate}$$
  $$\text{Estimated Cost} = \text{Received Qty} \times (\text{Chemical Cost} + \text{Utility Cost} + \text{Direct Labor})$$
  $$\text{Net P&L} = \text{Revenue} - \text{Estimated Cost}$$

---

## ⚡ Sia Decentralized Storage & Awesome-Selfhosted Integration
* **Sia Cloud Storage Integration**:
  * [devs.sia.storage](https://devs.sia.storage) আর্কিটেকচার অনুসরণে বিকেন্দ্রীভূত এনক্রিপ্টেড ব্যাকআপ সাপোর্ট।
  * থার্ড পার্টি সার্ভারের ওপর নির্ভর না করে ক্লাউড স্ন্যাপশট সরাসরি ডিস্ট্রিবিউটেড স্টোরেজে সিঙ্ক করার ব্যবস্থা।
* **Awesome-Selfhosted Standards**:
  * [awesome-selfhosted.net](https://awesome-selfhosted.net) কমপ্লায়েন্স অনুযায়ী ডকার, কুবারনেটিস এবং স্ট্যান্ডঅ্যালোন নোড/পিএইচপি রানটাইম উপযোগী সম্পূর্ণ সেলফ-হোস্টেড ডিপ্লয়মেন্ট।

---

## 🌐 AionUI Global Omni Control & OfficeCLI
* **AionUI Global Control**:
  * [aionui.com](https://www.aionui.com/en/) অনুসরণে ডিজাইনকৃত সুপার অ্যাডমিন ড্যাশবোর্ড।
  * সুপার অ্যাডমিন (`tanzirerp`) পৃথিবীর যেকোনো দেশ থেকে এক ক্লিকে সম্পূর্ণ সিস্টেম রিস্টার্ট, ক্যাশ ক্লিয়ারিং, ডেটাবেস ইঞ্জিন সুইচ এবং ব্যাকআপ মনিটর করতে পারেন।
* **OfficeCLI**:
  * [github.com/iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) কমান্ড-লাইন আর্কিটেকচার অনুযায়ী ইন-অ্যাপ টার্মিনাল কমান্ড সেন্টার।

---

## 📥 Live Database Export & Restore APIs
সিস্টেমে লাইভ ডেটাবেজ এক্সপোর্ট ও ইমপোর্টের জন্য সরাসরি এন্ডপয়েন্ট রয়েছে:
* **MySQL SQL Export**: `GET /api/backup/export-sql` (সম্পূর্ণ `erp_db.sql` ফাইল ডাউনলোড যা যেকোনো MySQL/MariaDB সার্ভারে সরাসরি ইমপোর্টযোগ্য)।
* **JSON Full Snapshot**: `GET /api/backup/export` (সকল অর্ডার, লগ, বায়ার ডেটা ও ইউজারদের কমপ্লিট JSON ব্যাকআপ)।
* **Snapshot Restore**: `POST /api/backup/restore` (ব্যাকআপ ফাইল আপলোড করে ১-ক্লিকে ডেটাবেস রিস্টোর)।
* **Google Drive Sync Trigger**: `POST /api/backup/gdrive/sync` (ড্রাইভে ইনস্ট্যান্ট স্ন্যাপশট পাঠানোর কল)।

---

## 🛠️ মাল্টি-ডাটাবেজ সাপোর্ট (`DATABASE_MODE`)
Wash ERP এর `.env` ফাইলে প্রয়োজনমতো যেকোনো ডেটাবেজ মোড নির্বাচন করা যায়:
```env
# Database Mode Options: sqlite | turso | polardb | firebase | supabase
DATABASE_MODE=sqlite
LOCAL_DB_PATH=./data/wash_erp.db

# Turso Cloud (Managed SQLite)
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-token-here

# JWT Auth Secret
JWT_SECRET=internal-security-secret-key-2026
```

---

## 🔐 ডিফল্ট সিস্টেম ইউজার ও ক্রেডেনশিয়ালস
| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `tanzirerp` | `tanziradmin` | Full Global Omni Access, Hosting & Cloud Control |
| **System Admin** | `admin` | `admin` | All Modules, User Whitelist & Database Mode Switch |
| **Wash MD** | `washmd` | `washmd123` | Full Production + Revenue P&L Financial Access |
| **Wash Manager** | `washmanager` | `manager123` | Operations + Revenue P&L Financial Access |
| **Operator** | `operator` | `operator123` | Data Entry (No Financial P&L Access) |
| **Viewer** | `viewer` | `viewer123` | Read-only Reports (No Financial P&L Access) |

---

## 📜 ERP Business Logic Rules
1. **First Recv & Last Delivery Preservation**: অর্ডার ক্লোজ বা আপডেট করার সময় প্রথম রিসিভ এবং সর্বশেষ ডেলিভারি রেকর্ড কখনো ডিলিট বা ওভাররাইট হবে না।
2. **Next Plan Archive Logic**: পূর্বের প্ল্যানের ডেটা কখনো মুছে ফেলা যাবে না; তা স্বয়ংক্রিয়ভাবে **Buyer Data Bank**-এ আর্কাইভ হবে।
3. **Role Gated Privacy**: ফাইন্যান্সিয়াল ডেটা শুধু MD ও Manager এর জন্য সংরক্ষিত।

---

## ⚖️ আইনগত সতর্কবার্তা ও কপিরাইট অধিকার (Legal Notice)

> **Developer & Owner:** **Tanzir Ahmed**  
> **Official ERP Software:** Industrial Garment Washing ERP (RMG)  
> **Copyright:** © 2026 Tanzir Ahmed. All Rights Reserved.

### ⚠️ পাইরেসি ও অননুমোদিত নকল সংক্রান্ত সতর্কবার্তা:
এই সাইট, ডিজাইন ও কন্ট্রোল সিস্টেমের কোনো অংশ অনুমতি ছাড়া ক্লোন বা নকল করা **সম্পূর্ণ বেআইনি**। পাইরেসি করা হলে সাইবার সুরক্ষা আইন ও কপিরাইট আইনের অধীনে আইনি ব্যবস্থা নেয়া হবে।

সোর্স কোড, ডাটাবেজ মডেল, অ্যালগরিদম বা ইন্টারফেস ডিজাইন অনুমতি ছাড়া বাণিজ্যিক বা ব্যক্তিগতভাবে চুরি/অনুকরণ করা হলে জাতীয় ও আন্তর্জাতিক বুদ্ধিবৃত্তিক সম্পদ সুরক্ষা আইন (WIPO Intellectual Property Rights) এবং ডিজিটাল সাইবার আইনের অধীনে তাৎক্ষণিক ক্ষতিপূরণ দাবি ও ফৌজদারি মামলা দায়ের করা হবে।

---

## 🤝 Support the Developer (ডেভেলপারকে সমর্থন)

এই সম্পূর্ণ ERP সিস্টেমটি তৈরি এবং পরিচালনা করছেন **Tanzir Ahmed**। 
* **Developer & Architect:** Tanzir Ahmed
* **Official Support Email:** `tanzir.iu@gmail.com`
* **Custom Enterprise Support:** আপনার ওয়াশ প্ল্যান্টের কাস্টম রিকোয়ারমেন্ট, আইওটি মেশিন কানেক্টিভিটি বা ক্লাউড অটোমেশনের জন্য সরাসরি যোগাযোগ করুন।
* **Feedback & Collaboration:** যেকোনো বাগ রিপোর্ট বা নতুন ফিচার প্রস্তাবনার জন্য ডেভেলপার ইমেইল উন্মুক্ত।

---

## 📜 MIT License

This project is licensed under the terms of the official **MIT License** with proprietary developer recognition and trademark ownership retained by **Tanzir Ahmed**.

```text
MIT License

Copyright (c) 2026 Tanzir Ahmed

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
