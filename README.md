# Wash ERP

<p align="center">
  <img src="./public/logo.svg" width="120" height="120" alt="Wash ERP Logo" />
</p>

<p align="center">
  <b>A high-performance enterprise ERP system specifically designed for Garment Wash industry tracking, featuring integrated Odoo workspaces, Oracle APEX modules, and multi-adapter SQL/NoSQL storage.</b>
</p>

[![Open in Google AI Studio](https://img.shields.io/badge/Open%20in-Google%20AI%20Studio-blue?logo=google&logoColor=white)](https://ai.studio/build)

---

## 📌 System Status & Version Metadata
* **Current Stable Version**: `v3.0.0`
* **Release Stage**: Production Ready / Enterprise Tested
* **Database Engine**: Multi-mode Adapter System (Auto-detecting PolarDB, Turso, Firebase, SQLite)
* **Last Code & Database Sync**: **2026-08-09 (August 9, 2026)**
* **Compiled Status**: 🟢 Fully Compiled & Verified

---

## 📈 Enterprise Version Changelog

### 🚀 [v3.0.0] - 2026-08-09 (Current Version)
* **🌟 Feature (Database Update)**: Added full enterprise **PolarDB (PostgreSQL)** database adapter using **Sequelize ORM** for mission-critical, high-availability multi-write scaling.
* **🌟 Feature (Oracle APEX integration)**: Bootstrapped dynamic **Oracle APEX Low-Code Workspace** with a declarative model builder, SQL Command terminal, and direct interactive PL/SQL triggers.
* **🔧 Core Bug Fixes**:
  * Resolved critical React duplicate `key` warnings across CRM, Purchase Orders, and Gantt project tasks.
  * Added auto-fallback mapping for seeded database states without assigned physical UUIDs.
  * Enhanced linter-compliant loop references to guarantee zero component tree crashes.
* **🎨 Visuals**: Re-architected global workspace grids to feature beautiful high-contrast badges and streamlined navigation tabs for increased productivity.

### [v2.1.0] - 2026-05-09
* **🚀 Feature**: Added "All Buyer Data Bank" with detailed transaction history modals.
* **🚀 Feature**: Robust Excel Import mapping (supports multiple header names).
* **🔧 Fix**: Resolved `sqlite3` driver conflicts and `TURSO` 404 connection bugs.
* **🎨 Design**: New high-contrast sidebar and "WASH ERP" branding.

### [v2.0.0] - 2026-05-08
* **Initial Release**: Basic Dashboard and Daily Log functionality.
* **Database**: Turso/SQLite unified adapter.

---

## 🚀 Key Features
* **Next ERP Plan Logic**: Robust duplicate checking (Buyer + File + Style + Color). Retains the latest records without redundant storage.
* **GMT & CPL Sync**: Real-time status tracking between production floors and the wash plan.
* **Transaction History**: "First Recv" and "Last Delivery" timestamps preserved for every single order.
* **Data Archiving**: Automated "Buyer Data Bank" for closed orders with full audit logs.
* **Role-Based Access**: Secure internal authentication for Admin, Editor, and Operators.

---

## 🛠️ Unified Database Providers Setup

You can customize the underlying database of Wash ERP by modifying `DATABASE_MODE` in your `.env` file. The adapter layer will dynamically handle initialization.

### 1. ⚡ PolarDB PostgreSQL & Sequelize (Newly Added)
Designed for cloud-native database workloads requiring massive transactional volumes.
* **`.env` Variables**:
  ```env
  DATABASE_MODE=polardb
  POLARDB_DATABASE_URL="postgres://username:password@your-polardb-endpoint:5432/your_db?sslmode=require"
  ```
* **Adapter Specifics**:
  * Utilizes `sequelize` as the primary ORM.
  * Automatically creates core tables (`users`, `erp_orders`, `daily_logs`, `buyer_data_bank`, `audit_logs`) on first connection.
  * Stores dynamic schemas as JSON string payloads inside PostgreSQL TEXT blocks to support schema flexibility.

### 2. 🟢 Turso (Managed SQLite)
* **`.env` Variables**:
  ```env
  DATABASE_MODE=turso
  TURSO_DATABASE_URL="libsql://your-db-name.turso.io"
  TURSO_AUTH_TOKEN="your-secret-auth-token-here"
  ```
* *⚠️ Warning: Do not use the browser URL (turso.io/organizations/...) as your database URL. Connect directly via `libsql://`.*

### 3. 🔴 Firebase Firestore
* **`.env` Variables**:
  ```env
  DATABASE_MODE=firebase
  FIREBASE_API_KEY="your-api-key"
  FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
  FIREBASE_PROJECT_ID="your-project-id"
  FIREBASE_APP_ID="your-app-id"
  ```

### 4. 🟠 CockroachDB / 🔵 Supabase / 🟣 Xata / 🟡 PocketBase
Supported using dedicated configuration files located in `/src/server/db/adapters/`. Access the desired workspace folder to view individual client details.

---

## 🔐 Security & Compliance Checklist
* [x] **No exposure of passwords**: Passwords are never returned in JSON/API payload responses.
* [x] **Server-side validation**: Roles, session integrity, and permissions are enforced prior to mutations.
* [x] **Session isolation**: Cookie variables flagged with `httpOnly`, `SameSite=Strict`, and JWT encryption.
* [x] **Auditability**: Complete logging of operator login sessions containing IP tracking and time records.
* [x] **Data Protection**: Critical buyer master files are securely archived inside the **Buyer Data Bank** instead of permanent deletion.

---

## 🇧🇩 Vercel Deployment & Database Connection Guide (Bengali Version)

Google AI Studio থেকে অ্যাপটি ডাউনলোড করে বা GitHub এর মাধ্যমে Vercel এ ডিপ্লয় করার সময় নিচের পদক্ষেপগুলো অনুসরণ করুন:

### ১. যা যা Git বা Zip এ রাখা যাবে না (Excluded Files)
* `.env` ফাইল (যাতে আপনার সিক্রেট কী থাকে)।
* `node_modules/` এবং `dist/` ফোল্ডার।
* লোকাল ডাটাবেস ফাইল যেমন `*.db` বা `*.sqlite`।

### ২. Vercel এ PolarDB / PostgreSQL কানেকশন সেটআপ
Vercel ড্যাশবোর্ড এ গিয়ে আপনার প্রোজেক্টে নিচের Environment Variables গুলো যোগ করুন:
* `DATABASE_MODE`: `polardb`
* `POLARDB_DATABASE_URL`: `postgres://user:password@host:5432/dbname` (আপনার PolarDB ক্লাউড কানেকশন স্ট্রিং)
* `JWT_SECRET`: (একটি সিকিউর রানডম পাসওয়ার্ড কী)

### ৩. ডিফল্ট লগইন ইউজার
সফলভাবে ডাটাবেস কানেক্ট হলে প্রথমবার লগইন করার জন্য নিচের তথ্য ব্যবহার করুন:
* **Username**: `admin`
* **Password**: `admin`
*(সিস্টেমটি প্রথম কানেকশনে অটোমেটিক এই অ্যাকাউন্টটি আপনার ডাটাবেসে তৈরি করে দিবে)*

---

## 📄 License
MIT License - feel free to use for your organization Wash ERP.

* **Built with ❤️ Tanzir Ahmed**
* **Optimized for Vercel + Turso + PolarDB Integration**
