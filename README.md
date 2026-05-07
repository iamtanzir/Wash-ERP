# Wash ERP

A simplified, robust enterprise resource planning system with basic internal authentication, built for secure environments.

## 🚀 Key Features
- **Internal Authentication**: Simple username/password login.
- **Default Admin**: Access out-of-the-box with `admin / admin`.
- **RBAC (Role Based Access Control)**:
- **Admin**: User directory management, role assignment, status toggling.
- **Editor**: Data entry, ERP Excel plan uploads.
- **Viewer**: Read-only access to dashboards and reports.
- **Operator**: Access for daily log entries.
- **Excel-to-ERP Engine**: Server-side parsing of master ERP plans.
- **Audit Logging**: Mandatory trail of all login and data modification events.

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

## 📦 Deployment Guide (Vercel + Database Options)

### 1. Preparation (General)
When pushing to GitHub or uploading to Vercel, **DO NOT** include:
- `node_modules/`, `dist/`, `.env`, and any local `.db` or `.sqlite` files.

### 2. Choose Your Database Provider
Set `DATABASE_MODE` to your preferred provider and add its required variables in Vercel:

#### 🟢 Turso (Recommended)
- `DATABASE_MODE`: `turso`
- `TURSO_DATABASE_URL`: `libsql://your-db-name.turso.io`
- `TURSO_AUTH_TOKEN`: (Your Auth Token)

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
- `DATABASE_MODE`: `firebase`
- **Setup**: You must include `firebase-applet-config.json` in your root directory. This file contains your Firebase project credentials.

#### ⚪ SQLite (Not recommended for Vercel)
- `DATABASE_MODE`: `sqlite`
- **Note**: SQLite is file-based and will reset on every Vercel deployment/serverless cold start. Only use for temporary testing.

### 3. Shared Environment Variables
Always set these for any deployment:
- `JWT_SECRET`: (A random string like `openssl rand -hex 32`)
- `NODE_ENV`: `production`

### 4. Vercel Configuration Notes
- **Entry Point**: The backend is mapped via `/api/index.ts`.
- **Static Assets**: Frontend is built into `dist/` and served by Vercel's static router.
- **Rewrites**: All `/api/*` calls are automatically routed to the serverless function.

---
## 📄 License
MIT License - feel free to use for your organization Wash ERP.

- **Built with ❤️ Tanzir Ahmed**
- **Optimized for Vercel + Turso Integration**



