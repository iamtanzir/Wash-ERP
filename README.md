# Wash ERP

![Wash ERP Logo](https://placehold.co/600x150/1e293b/ffffff?text=WASH+ERP+v2.1)

[![Open in Google AI Studio](https://img.shields.io/badge/Open%20in-Google%20AI%20Studio-blue?logo=google&logoColor=white)](https://ai.studio/build)

A high-performance ERP system specifically designed for the garment wash industry tracking.

## 🖼️ Screenshots
| Dashboard | ERP Planning | Data Bank |
|-----------|--------------|-----------|
| ![Dashboard](./docs/dashboard.png) | ![Planning](./docs/planning.png) | ![History](./docs/history.png) |

## 🚀 Key Features
- **Next ERP Plan Logic**: Robust duplicate checking (Buyer + File + Style + Color). Retains the latest records.
- **GMT & CPL Sync**: Real-time status tracking between production floors and the wash plan.
- **Transaction History**: "First Recv" and "Last Delivery" timestamps preserved for every order.
- **Data Archiving**: Automated "Buyer Data Bank" for closed orders with full logs.
- **Role-Based Access**: Secure internal authentication for Admin, Editor, and Operators.

## 📈 Version Changelog

### [v2.1.0] - 2026-05-09
- **🚀 Feature**: Added "All Buyer Data Bank" with detailed transaction history modals.
- **🚀 Feature**: Robust Excel Import mapping (supports multiple header names).
- **🔧 Fix**: Resolved `sqlite3` driver conflicts and `TURSO` 404 connection bugs.
- **🎨 Design**: New high-contrast sidebar and "WASH ERP" branding.

### [v2.0.0] - 2026-05-08
- **Initial Release**: Basic Dashboard and Daily Log functionality.
- **Database**: Turso/SQLite unified adapter.

---

## 🔐 Security Configuration
- **Cookie Sessions**: Uses signed, httpOnly cookies with a 24-hour expiry.
- **Password Hashing**: Industry-standard Bcrypt hashing on the server.
- **Force Change**: New users are forced to change their temporary passwords on first login.
- **Admin Invariant**: System prevents deleting or deactivating the last active administrator.

## 🛠️ Security Checklist
- [x] **No exposure of passwords**: Passwords are never returned in API responses.
- [x] **Server-side validation**: Roles and permissions are enforced on the backend.
- [x] **Session isolation**: Cookies are flagged as httpOnly and SameSite=Strict.
- [x] **Auditability**: Every login attempt is logged with IP and timestamp.
- [x] **Zero-Leakage**: Protected routes throw 401/403 errors before any data fetch.

## 🛠️ GitHub Integrations
This repository is configured with several GitHub-native integrations to ensure code quality and community collaboration:
- **GitHub Actions (CI)**: Automated linting and build checks on every push and pull request.
- **Issue Templates**: Pre-configured templates for Bug Reports and Feature Requests.
- **PR Template**: A standardized checklist for contributing code.
- **Community Standards**: Includes `LICENSE`, `CONTRIBUTING.md`, and recommended repository health files.

## 📦 Deployment Guide (Vercel + Database Options)

### 1. Preparation (General)
When pushing to GitHub or uploading to Vercel, **DO NOT** include:
- `node_modules/`, `dist/`, `.env`, and any local `.db` or `.sqlite` files.

### 2. Choose Your Database Provider
Set `DATABASE_MODE` to your preferred provider and add its required variables in Vercel:

#### 🟢 Turso (Recommended)
- `DATABASE_MODE`: `turso`
- `TURSO_DATABASE_URL`: `libsql://your-db-name.turso.io` (⚠️ **DO NOT** use the dashboard URL from your browser address bar)
- `TURSO_AUTH_TOKEN`: (Your Auth Token from the 'Connect' tab)

#### 🟠 CockroachDB
- `DATABASE_MODE`: `cockroach`
- `COCKROACH_DATABASE_URL`: `postgresql://user:pass@host:port/db?sslmode=verify-full`

#### 🔵 Supabase
- `DATABASE_MODE`: `supabase`
- `SUPABASE_URL`: (Project URL)
- `SUPABASE_ANON_KEY`: (Anon/Public Key)

#### 🟣 Xata
- `DATABASE_MODE`: `xata`
- `XATA_DATABASE_URL`: (Database URL)
- `XATA_API_KEY`: (Your API Key)

#### 🟡 PocketBase
- `DATABASE_MODE`: `pocketbase`
- `POCKETBASE_URL`: (Your hosted PocketBase URL)

#### 🔴 Firebase
- **`DATABASE_MODE`**: `firebase`
- **Environment Variables (Required for Production/Vercel)**:
  - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`.
- **Deployment via Git/Zip**:
  - The local `firebase-applet-config.json` is typically ignored or not recommended for Git. 
  - **Always** set the environment variables mentioned above in your Vercel/Production dashboard. The code is designed to check for these variables before looking for the file.

### 🚩 Troubleshooting Common Issues

#### 1. Turso 404 Error
- **Cause**: You pasted the URL from your browser address bar (e.g., `turso.io/organizations/...`).
- **Fix**: Go to Turso > Select Database > **Connect** tab. Copy the URL that starts with `libsql://`.

#### 2. Firebase Config Missing
- **Cause**: Running the code from a Zip/Git download without the `firebase-applet-config.json` helper file.
- **Fix**: Set the `FIREBASE_*` environment variables in your deployment platform (Vercel, Railway, etc.).

#### 3. Default Login (Admin)
- **User ID**: `admin`
- **User Pass**: `admin`
- *(Note: The system automatically seeds this account on the first successful database connection.)*

### 3. Shared Environment Variables
Always set these for any deployment:
- `JWT_SECRET`: (A random string like `openssl rand -hex 32`)
- `NODE_ENV`: `production`

### 4. Vercel Configuration Notes
- **Entry Point**: The backend is mapped via `/api/index.ts`.
- **Static Assets**: Frontend is built into `dist/` and served by Vercel's static router.
- **Rewrites**: All `/api/*` calls are automatically routed to the serverless function.

---
## 🇧🇩 Vercel Deployment & Database Connection Guide (Bengali Version)

Google AI Studio থেকে অ্যাপটি ডাউনলোড করে বা GitHub এর মাধ্যমে Vercel এ ডিপ্লয় করার সময় নিচের পদক্ষেপগুলো অনুসরণ করুন:

### ১. যা যা Git বা Zip এ রাখা যাবে না (Excluded Files)
- `.env` ফাইল (যাতে আপনার সিক্রেট কী থাকে)।
- `node_modules/` এবং `dist/` ফোল্ডার।
- `firebase-applet-config.json` (এটি AI Studio এর লোকাল কনফিগ, প্রোডাকশনে Environment Variables ব্যবহার করা ভালো)।
- লোকাল ডাটাবেস ফাইল যেমন `*.db` বা `*.sqlite`।

### ২. Vercel এ ডাটাবেস কানেকশন সেটআপ
Vercel ড্যাশবোর্ড এ গিয়ে আপনার প্রোজেক্টে নিচের Environment Variables গুলো যোগ করুন:

#### **Firebase এর জন্য:**
- `DATABASE_MODE`: `firebase`
- `FIREBASE_API_KEY`: (আপনার Firebase API Key)
- `FIREBASE_PROJECT_ID`: (প্রোজেক্ট আইডি)
- `FIREBASE_AUTH_DOMAIN`: (অথ ডোমেইন)
- `FIREBASE_APP_ID`: (অ্যাপ আইডি)

#### **Turso (Managed SQLite) এর জন্য:**
- `DATABASE_MODE`: `turso`
- `TURSO_DATABASE_URL`: `libsql://your-db-org.turso.io` 
- **⚠️ গুরুত্বপূর্ণ সতর্কতা:** ব্রাউজারের অ্যাড্রেস বার থেকে লিঙ্ক কপি করবেন না (যেমন `https://turso.io/...`)। এটি ভুল। আপনাকে অবশ্যই আপনার ডাটাবেসের **Connect** ট্যাব থেকে `libsql://` দিয়ে শুরু হওয়া লিঙ্কটি নিতে হবে।
- `TURSO_AUTH_TOKEN`: (টারসো ড্যাশবোর্ড থেকে পাওয়া Full Access টোকেন)

### ৩. ডিফল্ট লগইন ইউজার
সফলভাবে ডাটাবেস কানেক্ট হলে প্রথমবার লগইন করার জন্য নিচের তথ্য ব্যবহার করুন:
- **Username**: `admin`
- **Password**: `admin`
*(সিস্টেমটি প্রথম কানেকশনে অটোমেটিক এই অ্যাকাউন্টটি আপনার ডাটাবেসে তৈরি করে দিবে)*

### ৪. লগইন বা ৪০৪ এরর ফিক্স
যদি আপনি ৪০৪ এরর দেখেন, তবে নিশ্চিত করুন যে আপনার `DATABASE_URL` সঠিক আছে এবং তা ব্রাউজারের ড্যাশবোর্ড ইউআরএল নয়।

---
## 📄 License
MIT License - feel free to use for your organization Wash ERP.

- **Built with ❤️ Tanzir Ahmed**
- **Optimized for Vercel + Turso Integration**

