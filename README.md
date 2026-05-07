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

## 📦 Deployment Guide
### Local Setup
1. `npm install`
2. Create a `.env` file with `DB_TYPE=sqlite`.
3. `npm run dev`
4. Login with `admin` and `admin`. You will be prompted to change your password.

### Production
1. This app is designed to run in AI Studio Build or exported to Cloud Run.
2. The `server.ts` handles static file serving automatically.
3. No environment variables are strictly required for the auth system to function, making it easy to migrate.

---
## 📄 License
MIT License - feel free to use for your organization Wash ERP.

- **Built with ❤️ Tanzir Ahmed**



