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

## 📦 Deployment Guide (Vercel + Turso)

### 1. Preparation (Files to Remove)
When pushing to GitHub or uploading to Vercel, **DO NOT** include these folders/files:
- `node_modules/` (Vercel installs these automatically)
- `dist/` (Generated during build)
- `test.db` (Local database file, used only for local development)
- `.env` (Never share secrets in your code repository)

### 2. Vercel Environment Variables
In your Vercel Dashboard, go to **Settings > Environment Variables** and add:
- `DATABASE_MODE`: `turso`
- `TURSO_DATABASE_URL`: (Your Turso Database URL)
- `TURSO_AUTH_TOKEN`: (Your Turso Auth Token)
- `JWT_SECRET`: (Any long random string for session security)

### 3. Vercel Configuration Notes
- **Entry Point**: The backend is mapped via `/api/index.ts`.
- **Static Assets**: Frontend is built into `dist/` and served by Vercel's static router.
- **Rewrites**: All `/api/*` calls are automatically routed to the serverless function.

---
## 📄 License
MIT License - feel free to use for your organization Wash ERP.

- **Built with ❤️ Tanzir Ahmed**
- **Optimized for Vercel + Turso Integration**



