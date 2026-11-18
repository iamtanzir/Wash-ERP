import dotenv from "dotenv";
if (!process.env.VERCEL) {
    dotenv.config();
}
import express from "express";
import http from "http";
import path from "path";
import os from "node:os";
import fs from "node:fs";
import multer from "multer";
import pkgXLSX from "xlsx";
const XLSX = pkgXLSX;
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getDatabase } from "./src/server/db/index.js";
import { generateProactivePlan, simulatePlanningScenario } from "./src/server/aiPlanner.js";
import {
    buildParquetBuffer,
    writeParquetFileAtomic,
    readParquetBuffer,
    benchmarkParquetVsCsv,
    type ParquetCodec
} from "./src/server/db/parquetEngine.js";
import {
    authenticateRpcServer,
    pushBuyersToRpc,
    pullRpcRecords,
    generateErpDockerCompose,
    type RpcConnectionConfig
} from "./src/server/erpRpcConnector.js";

let db = getDatabase();
const app = express();
app.set("trust proxy", 1);
const RUNTIME_DATA_ROOT = process.env.VERCEL ? path.join("/tmp", "wash-erp-data") : path.resolve("./data");

let dbSeedPromise: Promise<void> | null = null;

function isSuperAdminUser(user: any): boolean {
    if (!user) return false;
    const role = String(user.role || "").trim().toLowerCase();
    const username = String(user.username || "").trim().toLowerCase();
    return role === "super_admin" || username === "tanzirerp";
}

async function seedDatabase() {
    console.log("[SEED] Checking database initialization status...");
    const existingUsers = await db.getDocs("users").catch(() => []);
    if (existingUsers.length === 0) {
        const envUsername = String(process.env.SUPER_ADMIN_USERNAME || "").trim().toLowerCase();
        const envPassword = String(process.env.SUPER_ADMIN_PASSWORD || "");
        if (envUsername && envPassword && envPassword.length >= 6) {
            console.log(`[SEED] Provisioning initial Super User (${envUsername}) from environment variables...`);
            const hashedPassword = await bcrypt.hash(envPassword, 10);
            const now = new Date().toISOString();
            await db.setDoc("users", envUsername, {
                id: envUsername,
                username: envUsername,
                password_hash: hashedPassword,
                role: "super_admin",
                status: "active",
                created_at: now,
                updated_at: now
            });
        } else {
            console.log("[SEED] Database has 0 users. First-time Super User setup is required via /login.");
        }
    }
    console.log("[SEED] Database check completed.");
}

function getSeedPromise() {
    if (!dbSeedPromise) {
        dbSeedPromise = seedDatabase().catch(err => {
            console.error("[SEED] ❌ Seeding failed:", err.message);
            dbSeedPromise = null; // Reset so next request can retry
            throw err;
        });
    }
    return dbSeedPromise;
}

const ensureDb = async (req: any, res: any, next: any) => {
    // Only intercept API calls, skip health check
    if (!req.path.startsWith("/api/") || req.path === "/api/health") {
        return next();
    }
    try {
        let changed = false;
        if (req.cookies?.turso_url && req.cookies.turso_url !== process.env.TURSO_DATABASE_URL) {
            process.env.TURSO_DATABASE_URL = req.cookies.turso_url;
            changed = true;
        }
        if (req.cookies?.turso_token && req.cookies.turso_token !== process.env.TURSO_AUTH_TOKEN) {
            process.env.TURSO_AUTH_TOKEN = req.cookies.turso_token;
            changed = true;
        }
        if (req.cookies?.db_mode && req.cookies.db_mode !== process.env.DATABASE_MODE) {
            process.env.DATABASE_MODE = req.cookies.db_mode;
            changed = true;
        }
        if (req.cookies?.local_db_path && req.cookies.local_db_path !== process.env.LOCAL_DB_PATH) {
            process.env.LOCAL_DB_PATH = req.cookies.local_db_path;
            process.env.SQLITE_PATH = req.cookies.local_db_path;
            changed = true;
        }
        if (req.cookies?.parquet_dir && req.cookies.parquet_dir !== process.env.PARQUET_DIR) {
            process.env.PARQUET_DIR = req.cookies.parquet_dir;
            changed = true;
        }
        if (changed) {
            console.log(`[DB] Database configuration updated (Mode: "${process.env.DATABASE_MODE || 'default'}"). Reinitializing db.`);
            db = getDatabase();
            dbSeedPromise = null;
        }

        await getSeedPromise();
        next();
    } catch (err: any) {
        console.warn("[DB] Non-critical database connection issue on request:", err.message);
        // Do not crash or block the request with 500, allow proceeding with fallback behavior (e.g. Memory fallback)
        next();
    }
};

const PORT = Number(process.env.PORT) || 3000;
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET_KEY = process.env.JWT_SECRET || "inctl-internal-security-secret-key-2024";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_KEY);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(JWT_SECRET_KEY));

// Health check API endpoint (First API route for container/proxy health checks)
app.get(["/api/health", "/health"], (req, res) => {
    res.json({ status: "ok" });
});

app.use(ensureDb);

// Middleware: Auth Check supporting both secure iframe cookies and Bearer headers
const authenticate = async (req: any, res: any, next: any) => {
    let token = req.cookies?.auth_token;
    
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
            token = parts[1];
        }
    }
    
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid session" });
    }
};

const authorize = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
        if (!req.user) {
            return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
        if (isSuperAdminUser(req.user)) {
            return next();
        }
        const userRole = (req.user.role || "").toLowerCase();
        const hasAccess = 
            roles.includes(userRole) || 
            (roles.includes("admin") && (userRole === "admin" || userRole === "wash_md")) ||
            (roles.includes("editor") && (userRole === "admin" || userRole === "wash_md" || userRole === "wash_manager"));

        if (!hasAccess) {
            return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
        next();
    };
};

const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (!isSuperAdminUser(req.user)) {
        return res.status(403).json({ error: "Forbidden: Host & Cloud Admin access is restricted to Super User (super_admin)." });
    }
    next();
};

const setAuthCookie = (req: any, res: any, token: string) => {
    const isHttps = IS_PRODUCTION || Boolean(req.secure) || req.headers["x-forwarded-proto"] === "https";
    res.cookie("auth_token", token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000 // 24h
    });
};

// API: Check if initial Super User setup is required (database has 0 users)
app.get(["/api/auth/setup-status", "/api/setup-status"], async (req, res) => {
    try {
        const users = await db.getDocs("users").catch(() => []);
        const needsSetup = !Array.isArray(users) || users.length === 0;
        const hasSuperUser = Array.isArray(users) && users.some((u: any) => isSuperAdminUser(u));
        res.json({ needsSetup, hasSuperUser });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to check setup status", details: error.message });
    }
});

// API: First-Time Super User Setup (permanently locked once any user exists in the database)
app.post(["/api/auth/setup-super-user", "/api/setup-super-user"], async (req: any, res: any) => {
    try {
        const existingUsers = await db.getDocs("users").catch(() => []);
        if (Array.isArray(existingUsers) && existingUsers.length > 0) {
            return res.status(403).json({
                error: "Super User setup is already completed and locked in the database. Please log in."
            });
        }

        const rawUsername = String(req.body?.username || "").trim().toLowerCase();
        const password = String(req.body?.password || "");

        if (!rawUsername || !/^[a-z0-9._-]{3,32}$/.test(rawUsername)) {
            return res.status(400).json({
                error: "Super User ID must be 3-32 characters using only letters, numbers, dots, underscores, or hyphens."
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                error: "Password must be at least 6 characters long."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();

        const superUserRecord = {
            id: rawUsername,
            username: rawUsername,
            password_hash: hashedPassword,
            role: "super_admin",
            status: "active",
            created_at: now,
            updated_at: now
        };

        await db.setDoc("users", rawUsername, superUserRecord);

        const token = await new SignJWT({
            id: superUserRecord.id,
            username: superUserRecord.username,
            role: superUserRecord.role
        })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(JWT_SECRET);

        setAuthCookie(req, res, token);

        try {
            await Promise.race([
                db.addDoc("audit_logs", {
                    action: "setup_super_user",
                    userId: superUserRecord.id,
                    role: "super_admin",
                    ip: req.ip
                }),
                new Promise((resolve) => setTimeout(resolve, 1200))
            ]);
        } catch {}

        res.status(201).json({
            success: true,
            token,
            user: {
                id: superUserRecord.id,
                username: superUserRecord.username,
                role: superUserRecord.role
            }
        });
    } catch (error: any) {
        console.error("[AUTH] First-time Super User setup error:", error);
        res.status(500).json({ error: "Failed to initialize Super User", details: error.message });
    }
});

// API: Login
const handleLogin = async (req: any, res: any) => {
    const { username, password } = req.body || {};
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        console.log(`[AUTH] Attempting login for: ${username}`);
        const lowerUsername = username.toLowerCase();
        let userData: any = null;
        try {
            userData = await db.getDoc("users", lowerUsername);
        } catch (dbErr: any) {
            console.warn("[AUTH] Warning: DB fetch failed, using fallback logic if applicable. Error:", dbErr.message);
        }
        
        if (!userData) {
            console.warn(`[AUTH] User not found: ${username}`);
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        if (userData.status !== "active") {
            console.warn(`[AUTH] Account deactivated: ${username}`);
            return res.status(403).json({ error: "Account deactivated" });
        }

        const validPassword = await bcrypt.compare(password, userData.password_hash);
        if (!validPassword) {
            console.warn(`[AUTH] Password mismatch for user: ${username}`);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        console.log(`[AUTH] Login successful: ${username}`);

        // Create JWT token
        const token = await new SignJWT({
            id: userData.id,
            username: userData.username,
            role: userData.role
        })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(JWT_SECRET);

        setAuthCookie(req, res, token);

        try {
            await Promise.race([
                db.addDoc("audit_logs", {
                    action: "login",
                    userId: userData.id,
                    ip: req.ip
                }),
                new Promise((resolve) => setTimeout(resolve, 1200))
            ]);
        } catch (auditErr) {
            console.error("Audit log failed:", auditErr);
        }

        res.json({
            success: true,
            token,
            user: {
                id: userData.id,
                username: userData.username,
                role: userData.role
            }
        });

    } catch (error: any) {
        console.error("Login Error:", error);
        
        // Check for common Turso errors to give better feedback
        let errorMessage = `[DB Mode: ${process.env.DATABASE_MODE || "sqlite"}] Internal server error`;
        if (error.message?.includes("404")) {
            errorMessage = `Database Connection Error (404). Possible causes:\n1. Your TURSO_DATABASE_URL is a dashboard browser URL instead of a connection URL.\n2. The database name or organization name in the URL is slightly wrong.\n\nOriginal error: ${error.message}`;
        } else if (error.message?.includes("unauthorized") || error.message?.includes("401")) {
            errorMessage = `Database Auth Error (401): Please check your TURSO_AUTH_TOKEN.\n\nOriginal error: ${error.message}`;
        } else if (error.message?.includes("fetch")) {
            errorMessage = `Database Network Error: Failed to reach the database server.\n\nOriginal error: ${error.message}`;
        }

        res.status(500).json({ 
            error: errorMessage,
            details: error.message 
        });
    }
};

app.post(["/api/login", "/api/auth/login"], handleLogin);

const handleLogout = (req: any, res: any) => {
    const isHttps = IS_PRODUCTION || Boolean(req.secure) || req.headers["x-forwarded-proto"] === "https";
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/"
    });
    res.json({ success: true });
};

app.post(["/api/logout", "/api/auth/logout"], handleLogout);

app.get("/api/time", (req, res) => { res.json({ time: Date.now() }); });

const handleMe = (req: any, res: any) => {
    res.json({ user: req.user });
};

app.get(["/api/me", "/api/auth/me", "/api/auth/user"], authenticate, handleMe);

// User Management API
app.post("/api/admin/config/turso", authenticate, requireSuperAdmin, async (req, res) => {
    const { url, token } = req.body;
    if (!url || !token) return res.status(400).json({ error: "Missing fields" });

    try {
        process.env.TURSO_DATABASE_URL = url;
        process.env.TURSO_AUTH_TOKEN = token;
        
        res.cookie("turso_url", url, { httpOnly: true, secure: IS_PRODUCTION, sameSite: IS_PRODUCTION ? "none" : "lax", path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });
        res.cookie("turso_token", token, { httpOnly: true, secure: IS_PRODUCTION, sameSite: IS_PRODUCTION ? "none" : "lax", path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });

        db = getDatabase();
        dbSeedPromise = null;
        await getSeedPromise();
        
        res.json({ success: true, message: "Database credentials updated and verified." });
    } catch (e: any) {
        res.status(500).json({ error: "Failed to verify new credentials", details: e.message });
    }
});

// Host & System Info API (For Local PC, Raspberry Pi, LAN IPs, Google Drive Sync - Super Admin Only)
app.get("/api/system/host-info", authenticate, requireSuperAdmin, async (req, res) => {
    try {
        const networkInterfaces = os.networkInterfaces();
        const localIps: string[] = [];
        
        for (const interfaceName of Object.keys(networkInterfaces)) {
            const ifaceList = networkInterfaces[interfaceName];
            if (ifaceList) {
                for (const iface of ifaceList) {
                    if (iface.family === "IPv4" && !iface.internal) {
                        localIps.push(iface.address);
                    }
                }
            }
        }

        const isRaspberryPi = 
            os.arch().includes("arm") || 
            fs.existsSync("/etc/rpi-issue") || 
            fs.existsSync("/proc/device-tree/model");

        const localDbPath = path.resolve(process.env.LOCAL_DB_PATH || process.env.SQLITE_PATH || path.join(RUNTIME_DATA_ROOT, "erp_database.sqlite"));
        let dbFileExists = false;
        let dbFileSize = 0;
        try {
            if (fs.existsSync(localDbPath)) {
                dbFileExists = true;
                const stats = fs.statSync(localDbPath);
                dbFileSize = stats.size;
            }
        } catch (e) {}

        const backupDir = path.join(RUNTIME_DATA_ROOT, "gdrive_backups");
        let backupCount = 0;
        try {
            if (fs.existsSync(backupDir)) {
                backupCount = fs.readdirSync(backupDir).filter(f => f.endsWith(".json")).length;
            }
        } catch (e) {}

        let publicOnlineUrl = process.env.PUBLIC_ONLINE_URL || process.env.CLOUDFLARE_TUNNEL_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
        const onlineConfigPath = path.join(RUNTIME_DATA_ROOT, "online_config.json");
        if (!publicOnlineUrl && fs.existsSync(onlineConfigPath)) {
            try {
                const conf = JSON.parse(fs.readFileSync(onlineConfigPath, "utf-8"));
                publicOnlineUrl = conf.publicUrl || "";
            } catch (e) {}
        }

        const parquetDir = path.resolve(process.env.PARQUET_DIR || path.join(RUNTIME_DATA_ROOT, "parquet"));
        let parquetFiles: { filename: string; table: string; sizeBytes: number; updatedAt: string }[] = [];
        let parquetTotalBytes = 0;
        try {
            if (fs.existsSync(parquetDir)) {
                for (const file of fs.readdirSync(parquetDir).filter(f => f.endsWith(".parquet"))) {
                    const stats = fs.statSync(path.join(parquetDir, file));
                    parquetTotalBytes += stats.size;
                    parquetFiles.push({
                        filename: file,
                        table: file.replace(/\.parquet$/, ""),
                        sizeBytes: stats.size,
                        updatedAt: stats.mtime.toISOString()
                    });
                }
            }
        } catch (e) {}

        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            isRaspberryPi,
            localIps,
            port: PORT,
            dbMode: process.env.DATABASE_MODE || "local",
            localDbPath,
            parquetDir,
            parquetFiles,
            parquetTotalBytes,
            dbFileExists,
            dbFileSize,
            backupCount,
            gdriveSyncPath: process.env.GDRIVE_DB_PATH || "",
            publicOnlineUrl,
            timestamp: Date.now()
        });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to fetch host info", details: error.message });
    }
});

// Public Online URL Management (For Cloudflare Tunnel, Vercel, Custom Domains - Super Admin Only)
app.get("/api/system/public-url", authenticate, requireSuperAdmin, (req, res) => {
    let publicOnlineUrl = process.env.PUBLIC_ONLINE_URL || process.env.CLOUDFLARE_TUNNEL_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const onlineConfigPath = path.join(RUNTIME_DATA_ROOT, "online_config.json");
    if (!publicOnlineUrl && fs.existsSync(onlineConfigPath)) {
        try {
            const conf = JSON.parse(fs.readFileSync(onlineConfigPath, "utf-8"));
            publicOnlineUrl = conf.publicUrl || "";
        } catch (e) {}
    }
    res.json({ publicUrl: publicOnlineUrl });
});

app.post("/api/system/public-url", authenticate, requireSuperAdmin, (req, res) => {
    try {
        const { publicUrl } = req.body;
        const onlineConfigPath = path.join(RUNTIME_DATA_ROOT, "online_config.json");
        fs.mkdirSync(path.dirname(onlineConfigPath), { recursive: true });
        const cleanUrl = (publicUrl || "").trim();
        fs.writeFileSync(onlineConfigPath, JSON.stringify({ publicUrl: cleanUrl, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
        process.env.PUBLIC_ONLINE_URL = cleanUrl;
        res.json({ success: true, publicUrl: cleanUrl });
    } catch (err: any) {
        res.status(500).json({ error: "Failed to save public URL", details: err.message });
    }
});

// Check Online and Cloud Database Connectivity
app.get("/api/system/check-online", authenticate, async (req, res) => {
    try {
        const isTursoCloud = (process.env.DATABASE_MODE || "").toLowerCase() === "turso";
        res.json({
            online: true,
            dbMode: process.env.DATABASE_MODE || "local",
            isTursoCloud,
            serverTime: new Date().toISOString()
        });
    } catch (e: any) {
        res.status(500).json({ online: false, error: e.message });
    }
});

// Database Mode Switcher (Local SQLite, Google Drive Sync, Turso, Apache Parquet, Memory - Super Admin Only)
app.post("/api/admin/config/db-mode", authenticate, requireSuperAdmin, async (req, res) => {
    const { mode, localPath, parquetDir } = req.body;
    if (!mode) return res.status(400).json({ error: "Database mode is required" });

    try {
        // When switching into Apache Parquet mode, automatically sync current data into .parquet files if target is empty
        if (mode.toLowerCase() === "parquet") {
            const targetParquetDir = path.resolve(parquetDir || (localPath && !localPath.endsWith(".sqlite") ? localPath : "") || process.env.PARQUET_DIR || path.join(RUNTIME_DATA_ROOT, "parquet"));
            fs.mkdirSync(targetParquetDir, { recursive: true });
            process.env.PARQUET_DIR = targetParquetDir;
            res.cookie("parquet_dir", targetParquetDir, { httpOnly: true, secure: IS_PRODUCTION, sameSite: IS_PRODUCTION ? "none" : "lax", path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });

            const existingFiles = fs.existsSync(targetParquetDir) ? fs.readdirSync(targetParquetDir).filter(f => f.endsWith(".parquet")) : [];
            if (existingFiles.length === 0) {
                const cols = ["users", "erp_orders", "daily_logs", "buyer_data_bank", "audit_logs", "wash_mc_load_plans"];
                for (const col of cols) {
                    const docs = await db.getDocs(col).catch(() => []);
                    if (docs.length > 0 || col === "users") {
                        await writeParquetFileAtomic(path.join(targetParquetDir, `${col}.parquet`), docs, { codec: "SNAPPY", tableName: col });
                    }
                }
            }
        }

        process.env.DATABASE_MODE = mode;
        res.cookie("db_mode", mode, { httpOnly: true, secure: IS_PRODUCTION, sameSite: IS_PRODUCTION ? "none" : "lax", path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });

        if (localPath && mode.toLowerCase() !== "parquet") {
            process.env.LOCAL_DB_PATH = localPath;
            process.env.SQLITE_PATH = localPath;
            process.env.GDRIVE_DB_PATH = localPath;
            res.cookie("local_db_path", localPath, { httpOnly: true, secure: IS_PRODUCTION, sameSite: IS_PRODUCTION ? "none" : "lax", path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });
        }

        db = getDatabase();
        dbSeedPromise = null;
        await getSeedPromise();

        res.json({ 
            success: true, 
            message: `Database switched to ${mode.toUpperCase()} mode successfully.`,
            mode,
            localPath: process.env.LOCAL_DB_PATH || path.join(RUNTIME_DATA_ROOT, "erp_database.sqlite"),
            parquetDir: process.env.PARQUET_DIR || path.join(RUNTIME_DATA_ROOT, "parquet")
        });
    } catch (e: any) {
        res.status(500).json({ error: "Failed to switch database mode", details: e.message });
    }
});

// Full Database Export (For 15 GB Google Drive Backup or Local Archiving)
app.get("/api/backup/export", authenticate, async (req: any, res) => {
    try {
        console.log(`[BACKUP] Export initiated by user: ${req.user.username}`);
        const [orders, logs, buyers, users, audit] = await Promise.all([
            db.getDocs("erp_orders").catch(() => []),
            db.getDocs("daily_logs").catch(() => []),
            db.getDocs("buyer_data_bank").catch(() => []),
            db.getDocs("users").catch(() => []),
            db.getDocs("audit_logs").catch(() => [])
        ]);

        const backupPayload = {
            app: "INCTL Wash ERP",
            version: "2.5.0",
            exported_at: new Date().toISOString(),
            exported_by: req.user.username,
            counts: {
                erp_orders: orders.length,
                daily_logs: logs.length,
                buyer_data_bank: buyers.length,
                users: users.length,
                audit_logs: audit.length
            },
            data: {
                erp_orders: orders,
                daily_logs: logs,
                buyer_data_bank: buyers,
                users: users,
                audit_logs: audit
            }
        };

        const filename = `inctl_wash_erp_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(backupPayload, null, 2));
    } catch (error: any) {
        console.error("[BACKUP] Export failed:", error);
        res.status(500).json({ error: "Failed to generate database export", details: error.message });
    }
});

// Full MySQL / MariaDB SQL Dump for XAMPP, PC & Oracle Cloud Ubuntu MySQL
app.get("/api/backup/export-sql", authenticate, async (req: any, res) => {
    try {
        console.log(`[BACKUP] SQL Export initiated by user: ${req.user.username}`);
        const [orders, logs, buyers, users] = await Promise.all([
            db.getDocs("erp_orders").catch(() => []),
            db.getDocs("daily_logs").catch(() => []),
            db.getDocs("buyer_data_bank").catch(() => []),
            db.getDocs("users").catch(() => [])
        ]);

        const escapeSql = (val: any) => {
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "number") return val;
            if (typeof val === "boolean") return val ? 1 : 0;
            if (typeof val === "object") val = JSON.stringify(val);
            return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
        };

        const lines: string[] = [
            `-- ========================================================`,
            `-- INCTL Wash ERP - Complete MySQL Database Dump`,
            `-- Target: XAMPP / Laragon (PC) & Oracle Cloud Ubuntu MySQL`,
            `-- Generated at: ${new Date().toISOString()}`,
            `-- Exported by: ${req.user.username}`,
            `-- ========================================================\n`,
            `CREATE DATABASE IF NOT EXISTS \`erp_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
            `USE \`erp_db\`;\n`,
            `SET FOREIGN_KEY_CHECKS = 0;\n`,
            
            `-- Table: erp_orders`,
            `DROP TABLE IF EXISTS \`erp_orders\`;`,
            `CREATE TABLE \`erp_orders\` (`,
            `  \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,`,
            `  \`buyer\` VARCHAR(128) NULL,`,
            `  \`file_no\` VARCHAR(128) NULL,`,
            `  \`style_no\` VARCHAR(128) NULL,`,
            `  \`order_qty\` INT DEFAULT 0,`,
            `  \`wash_type\` VARCHAR(128) NULL,`,
            `  \`sew_floor\` VARCHAR(64) NULL,`,
            `  \`status\` VARCHAR(64) DEFAULT 'Running',`,
            `  \`color\` VARCHAR(64) NULL,`,
            `  \`erp_date\` VARCHAR(64) NULL,`,
            `  \`erp_ship_date\` VARCHAR(64) NULL,`,
            `  \`cpl_qty_kg\` DECIMAL(10,2) DEFAULT 0,`,
            `  \`item\` VARCHAR(128) NULL,`,
            `  \`plan\` VARCHAR(128) NULL,`,
            `  \`remarks\` TEXT NULL,`,
            `  \`created_at\` VARCHAR(64) NULL,`,
            `  \`updated_at\` VARCHAR(64) NULL,`,
            `  \`custom_values\` LONGTEXT NULL`,
            `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`
        ];

        if (orders.length > 0) {
            lines.push(`-- Data for erp_orders (${orders.length} rows)`);
            for (const o of orders) {
                lines.push(
                    `INSERT INTO \`erp_orders\` (\`id\`, \`buyer\`, \`file_no\`, \`style_no\`, \`order_qty\`, \`wash_type\`, \`sew_floor\`, \`status\`, \`color\`, \`erp_date\`, \`erp_ship_date\`, \`cpl_qty_kg\`, \`item\`, \`plan\`, \`remarks\`, \`created_at\`, \`updated_at\`, \`custom_values\`) VALUES (${escapeSql(o.id)}, ${escapeSql(o.buyer)}, ${escapeSql(o.file_no)}, ${escapeSql(o.style_no)}, ${o.order_qty || 0}, ${escapeSql(o.wash_type)}, ${escapeSql(o.sew_floor)}, ${escapeSql(o.status || 'Running')}, ${escapeSql(o.color)}, ${escapeSql(o.erp_date)}, ${escapeSql(o.erp_ship_date)}, ${o.cpl_qty_kg || 0}, ${escapeSql(o.item)}, ${escapeSql(o.plan)}, ${escapeSql(o.remarks)}, ${escapeSql(o.created_at)}, ${escapeSql(o.updated_at)}, ${escapeSql(o.custom_values)});`
                );
            }
            lines.push("");
        }

        lines.push(
            `-- Table: daily_logs`,
            `DROP TABLE IF EXISTS \`daily_logs\`;`,
            `CREATE TABLE \`daily_logs\` (`,
            `  \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,`,
            `  \`erp_order\` VARCHAR(64) NULL,`,
            `  \`log_date\` VARCHAR(64) NULL,`,
            `  \`received_qty\` INT DEFAULT 0,`,
            `  \`delivered_qty\` INT DEFAULT 0,`,
            `  \`unit\` VARCHAR(32) DEFAULT 'Pcs',`,
            `  \`ready_for_delivery_qty\` INT DEFAULT 0,`,
            `  \`remarks\` TEXT NULL,`,
            `  \`created_by\` VARCHAR(64) NULL,`,
            `  \`created_at\` VARCHAR(64) NULL`,
            `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`
        );

        if (logs.length > 0) {
            lines.push(`-- Data for daily_logs (${logs.length} rows)`);
            for (const l of logs) {
                lines.push(
                    `INSERT INTO \`daily_logs\` (\`id\`, \`erp_order\`, \`log_date\`, \`received_qty\`, \`delivered_qty\`, \`unit\`, \`ready_for_delivery_qty\`, \`remarks\`, \`created_by\`, \`created_at\`) VALUES (${escapeSql(l.id)}, ${escapeSql(l.erp_order)}, ${escapeSql(l.log_date)}, ${l.received_qty || 0}, ${l.delivered_qty || 0}, ${escapeSql(l.unit || 'Pcs')}, ${l.ready_for_delivery_qty || 0}, ${escapeSql(l.remarks)}, ${escapeSql(l.created_by)}, ${escapeSql(l.created_at)});`
                );
            }
            lines.push("");
        }

        lines.push(
            `-- Table: buyer_data_bank`,
            `DROP TABLE IF EXISTS \`buyer_data_bank\`;`,
            `CREATE TABLE \`buyer_data_bank\` (`,
            `  \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,`,
            `  \`buyer\` VARCHAR(128) NULL,`,
            `  \`file_no\` VARCHAR(128) NULL,`,
            `  \`style_no\` VARCHAR(128) NULL,`,
            `  \`order_qty\` INT DEFAULT 0,`,
            `  \`archived_at\` VARCHAR(64) NULL,`,
            `  \`total_received\` INT DEFAULT 0,`,
            `  \`total_delivered\` INT DEFAULT 0,`,
            `  \`custom_values\` LONGTEXT NULL`,
            `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`
        );

        if (buyers.length > 0) {
            lines.push(`-- Data for buyer_data_bank (${buyers.length} rows)`);
            for (const b of buyers) {
                lines.push(
                    `INSERT INTO \`buyer_data_bank\` (\`id\`, \`buyer\`, \`file_no\`, \`style_no\`, \`order_qty\`, \`archived_at\`, \`total_received\`, \`total_delivered\`, \`custom_values\`) VALUES (${escapeSql(b.id)}, ${escapeSql(b.buyer)}, ${escapeSql(b.file_no)}, ${escapeSql(b.style_no)}, ${b.order_qty || 0}, ${escapeSql(b.archived_at)}, ${b.total_received || 0}, ${b.total_delivered || 0}, ${escapeSql(b.custom_values)});`
                );
            }
            lines.push("");
        }

        lines.push(
            `-- Table: users`,
            `DROP TABLE IF EXISTS \`users\`;`,
            `CREATE TABLE \`users\` (`,
            `  \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,`,
            `  \`username\` VARCHAR(64) UNIQUE,`,
            `  \`password_hash\` VARCHAR(255) NULL,`,
            `  \`role\` VARCHAR(64) DEFAULT 'viewer',`,
            `  \`status\` VARCHAR(32) DEFAULT 'active',`,
            `  \`created_at\` VARCHAR(64) NULL`,
            `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`
        );

        if (users.length > 0) {
            lines.push(`-- Data for users (${users.length} rows)`);
            for (const u of users) {
                lines.push(
                    `INSERT INTO \`users\` (\`id\`, \`username\`, \`password_hash\`, \`role\`, \`status\`, \`created_at\`) VALUES (${escapeSql(u.id)}, ${escapeSql(u.username)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.role)}, ${escapeSql(u.status)}, ${escapeSql(u.created_at)});`
                );
            }
            lines.push("");
        }

        lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
        lines.push(`-- Dump completed on ${new Date().toISOString()}`);

        const filename = `erp_db_${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/sql");
        res.send(lines.join("\n"));
    } catch (error: any) {
        console.error("[BACKUP] SQL Export failed:", error);
        res.status(500).json({ error: "Failed to generate SQL database dump", details: error.message });
    }
});

// Restore Database from Snapshot
app.post("/api/backup/restore", authenticate, authorize(["admin"]), upload.single("file"), async (req: any, res) => {
    try {
        let backupPayload: any = null;

        if (req.file) {
            const fileContent = req.file.buffer.toString("utf-8");
            backupPayload = JSON.parse(fileContent);
        } else if (req.body.backupData) {
            backupPayload = typeof req.body.backupData === "string" 
                ? JSON.parse(req.body.backupData) 
                : req.body.backupData;
        }

        if (!backupPayload || !backupPayload.data) {
            return res.status(400).json({ error: "Invalid backup format. Missing 'data' object." });
        }

        const counts: any = {};
        const collections = ["erp_orders", "daily_logs", "buyer_data_bank", "users", "audit_logs"];

        for (const col of collections) {
            const records = backupPayload.data[col];
            if (Array.isArray(records)) {
                let colCount = 0;
                for (const item of records) {
                    if (item && item.id) {
                        // Protect existing Super User accounts from accidental overwrite during restore
                        if (col === "users") {
                            const existingTarget = await db.getDoc("users", String(item.id).toLowerCase()).catch(() => null);
                            if (existingTarget && isSuperAdminUser(existingTarget)) {
                                continue;
                            }
                        }
                        await db.setDoc(col, item.id, item);
                        colCount++;
                    }
                }
                counts[col] = colCount;
            }
        }

        // Save record into system_backups
        try {
            await db.addDoc("system_backups", {
                filename: req.file ? req.file.originalname : "direct_restore.json",
                action: "restore",
                restored_by: req.user.username,
                counts: JSON.stringify(counts),
                created_at: new Date().toISOString()
            });
        } catch (e) {}

        res.json({
            success: true,
            message: "Database successfully restored from snapshot.",
            restoredCounts: counts
        });
    } catch (error: any) {
        console.error("[BACKUP] Restore error:", error);
        res.status(500).json({ error: "Failed to restore database", details: error.message });
    }
});

// Google Drive Cloud Sync Trigger & Auto Snapshot
app.post("/api/backup/gdrive/sync", authenticate, async (req: any, res) => {
    try {
        const backupDir = path.join(RUNTIME_DATA_ROOT, "gdrive_backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const [orders, logs, buyers, users] = await Promise.all([
            db.getDocs("erp_orders").catch(() => []),
            db.getDocs("daily_logs").catch(() => []),
            db.getDocs("buyer_data_bank").catch(() => []),
            db.getDocs("users").catch(() => [])
        ]);

        const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `inctl_erp_gdrive_snapshot_${timestampStr}.json`;
        const filePath = path.join(backupDir, filename);

        const snapshot = {
            app: "INCTL Wash ERP",
            version: "2.5.0",
            target: "Google Drive Cloud 15GB Backup",
            timestamp: new Date().toISOString(),
            synced_by: req.user.username,
            counts: {
                erp_orders: orders.length,
                daily_logs: logs.length,
                buyer_data_bank: buyers.length,
                users: users.length
            },
            data: {
                erp_orders: orders,
                daily_logs: logs,
                buyer_data_bank: buyers,
                users: users
            }
        };

        const jsonContent = JSON.stringify(snapshot, null, 2);
        fs.writeFileSync(filePath, jsonContent, "utf-8");
        const fileSize = Buffer.byteLength(jsonContent);

        // If custom Google Drive local sync directory is configured (e.g. G:\My Drive\... or /mnt/gdrive/...)
        const gdrivePath = process.env.GDRIVE_DB_PATH || req.body.targetFolder;
        let syncedToExternalFolder = false;
        if (gdrivePath) {
            try {
                const targetDir = path.resolve(gdrivePath);
                if (fs.existsSync(targetDir)) {
                    fs.writeFileSync(path.join(targetDir, filename), jsonContent, "utf-8");
                    syncedToExternalFolder = true;
                }
            } catch (extErr: any) {
                console.warn("[BACKUP] Notice: external drive sync directory skipped:", extErr.message);
            }
        }

        // Record in system_backups
        try {
            await db.addDoc("system_backups", {
                filename,
                size_bytes: fileSize,
                record_counts: JSON.stringify(snapshot.counts),
                storage_target: syncedToExternalFolder ? `Google Drive (${gdrivePath})` : "Local Snapshot Archive",
                created_at: new Date().toISOString()
            });
        } catch (e) {}

        res.json({
            success: true,
            filename,
            sizeBytes: fileSize,
            syncedToExternalFolder,
            counts: snapshot.counts,
            message: `Snapshot successfully saved (${(fileSize / 1024).toFixed(1)} KB). Ready for Google Drive storage.`
        });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to create Google Drive snapshot", details: error.message });
    }
});

// List Historical Backups
app.get("/api/backup/list", authenticate, async (req, res) => {
    try {
        const backupDir = path.join(RUNTIME_DATA_ROOT, "gdrive_backups");
        const backups: any[] = [];

        if (fs.existsSync(backupDir)) {
            const files = fs.readdirSync(backupDir).filter(f => f.endsWith(".json"));
            for (const file of files) {
                try {
                    const stats = fs.statSync(path.join(backupDir, file));
                    backups.push({
                        filename: file,
                        sizeBytes: stats.size,
                        createdAt: stats.mtime.toISOString(),
                        type: "local_snapshot"
                    });
                } catch (e) {}
            }
        }

        // Sort latest first
        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json({ backups });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to list backups" });
    }
});

// Apache Parquet Columnar Storage & Live CSV vs Parquet Benchmark Stats
const PARQUET_TABLES = ["erp_orders", "daily_logs", "buyer_data_bank", "users", "wash_mc_load_plans", "audit_logs"] as const;

app.get("/api/backup/parquet/stats", authenticate, async (req: any, res) => {
    try {
        const parquetDir = path.resolve(process.env.PARQUET_DIR || path.join(RUNTIME_DATA_ROOT, "parquet"));
        const tableStats = await Promise.all(
            PARQUET_TABLES.map(async (table) => {
                const rows = await db.getDocs(table).catch(() => []);
                const stats = await benchmarkParquetVsCsv(table, rows);
                const diskPath = path.join(parquetDir, `${table}.parquet`);
                const savedOnDisk = fs.existsSync(diskPath);
                const diskBytes = savedOnDisk ? fs.statSync(diskPath).size : 0;
                const diskUpdatedAt = savedOnDisk ? fs.statSync(diskPath).mtime.toISOString() : null;
                return {
                    ...stats,
                    savedOnDisk,
                    diskBytes,
                    diskUpdatedAt
                };
            })
        );

        const totals = tableStats.reduce(
            (acc, s) => {
                acc.totalRows += s.rowCount;
                acc.csvBytes += s.csvBytes;
                acc.jsonBytes += s.jsonBytes;
                acc.parquetSnappyBytes += s.parquetSnappyBytes;
                acc.parquetGzipBytes += s.parquetGzipBytes;
                acc.diskBytes += s.diskBytes;
                acc.csvParseMs += s.csvParseMs;
                acc.parquetReadMs += s.parquetReadMs;
                return acc;
            },
            { totalRows: 0, csvBytes: 0, jsonBytes: 0, parquetSnappyBytes: 0, parquetGzipBytes: 0, diskBytes: 0, csvParseMs: 0, parquetReadMs: 0 }
        );

        const bestParquetTotal = Math.min(totals.parquetSnappyBytes, totals.parquetGzipBytes) || totals.parquetSnappyBytes;
        const overallCompressionVsCsv = totals.csvBytes > 0 && bestParquetTotal > 0 ? Number((totals.csvBytes / bestParquetTotal).toFixed(2)) : 1;
        const overallSpaceSavedPercent = totals.csvBytes > 0 ? Number(Math.max(0, ((totals.csvBytes - bestParquetTotal) / totals.csvBytes) * 100).toFixed(1)) : 0;
        const overallSpeedup = totals.parquetReadMs > 0 ? Number(Math.max(1, totals.csvParseMs / totals.parquetReadMs).toFixed(1)) : 1;

        res.json({
            parquetDir,
            tables: tableStats,
            summary: {
                ...totals,
                overallCompressionVsCsv,
                overallSpaceSavedPercent,
                overallSpeedup: Number(overallSpeedup)
            }
        });
    } catch (error: any) {
        console.error("[PARQUET] Stats error:", error);
        res.status(500).json({ error: "Failed to compute Parquet storage stats", details: error.message });
    }
});

// Sync All ERP Tables into Compressed .parquet Columnar Vault
app.post("/api/backup/parquet/sync", authenticate, async (req: any, res) => {
    try {
        const codecInput = String(req.body?.codec || "GZIP").toUpperCase();
        const codec: ParquetCodec = codecInput === "SNAPPY" || codecInput === "UNCOMPRESSED" ? codecInput : "GZIP";
        const customFolder = req.body?.targetFolder ? path.resolve(String(req.body.targetFolder)) : "";
        const parquetDir = path.resolve(process.env.PARQUET_DIR || path.join(RUNTIME_DATA_ROOT, "parquet"));
        fs.mkdirSync(parquetDir, { recursive: true });

        const results: { table: string; filename: string; rows: number; csvBytes: number; parquetBytes: number; savedPercent: number }[] = [];

        for (const table of PARQUET_TABLES) {
            const rows = await db.getDocs(table).catch(() => []);
            const filePath = path.join(parquetDir, `${table}.parquet`);
            const parquetBytes = await writeParquetFileAtomic(filePath, rows, { codec, tableName: table });
            const stats = await benchmarkParquetVsCsv(table, rows);

            if (customFolder && fs.existsSync(customFolder)) {
                try {
                    await writeParquetFileAtomic(path.join(customFolder, `${table}.parquet`), rows, { codec, tableName: table });
                } catch {}
            }

            results.push({
                table,
                filename: `${table}.parquet`,
                rows: rows.length,
                csvBytes: stats.csvBytes,
                parquetBytes,
                savedPercent: stats.csvBytes > 0 ? Number(Math.max(0, ((stats.csvBytes - parquetBytes) / stats.csvBytes) * 100).toFixed(1)) : 0
            });
        }

        const totalParquetBytes = results.reduce((s, r) => s + r.parquetBytes, 0);
        const totalCsvBytes = results.reduce((s, r) => s + r.csvBytes, 0);

        res.json({
            success: true,
            codec,
            parquetDir,
            results,
            totalParquetBytes,
            totalCsvBytes,
            message: `Saved ${results.length} tables into Apache Parquet (${codec}) — ${(totalParquetBytes / 1024).toFixed(1)} KB total!`
        });
    } catch (error: any) {
        console.error("[PARQUET] Sync error:", error);
        res.status(500).json({ error: "Failed to sync data to Apache Parquet", details: error.message });
    }
});

// Download Any ERP Table directly as an Apache Parquet (.parquet) Columnar File
app.get("/api/backup/parquet/export/:table", authenticate, async (req: any, res) => {
    try {
        const table = String(req.params.table || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        if (!PARQUET_TABLES.includes(table as any)) {
            return res.status(400).json({ error: `Unsupported table "${table}"` });
        }
        const codecInput = String(req.query?.codec || "GZIP").toUpperCase();
        const codec: ParquetCodec = codecInput === "SNAPPY" || codecInput === "UNCOMPRESSED" ? codecInput : "GZIP";

        const rows = await db.getDocs(table).catch(() => []);
        const parquetBuffer = buildParquetBuffer(rows, { codec, tableName: table });
        const filename = `${table}_${new Date().toISOString().slice(0, 10)}.parquet`;

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/vnd.apache.parquet");
        res.send(parquetBuffer);
    } catch (error: any) {
        console.error("[PARQUET] Export error:", error);
        res.status(500).json({ error: "Failed to export .parquet file", details: error.message });
    }
});

// Restore / Import a .parquet File Directly into the ERP Database
app.post("/api/backup/parquet/restore", authenticate, authorize(["admin"]), upload.single("file"), async (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No .parquet file uploaded" });
        }
        const table = String(req.body?.table || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        if (!PARQUET_TABLES.includes(table as any)) {
            return res.status(400).json({ error: `Invalid target table "${table}"` });
        }

        const { rows, readTimeMs } = await readParquetBuffer(req.file.buffer);
        let restored = 0;

        for (const item of rows) {
            if (item && item.id) {
                if (table === "users") {
                    const existingTarget = await db.getDoc("users", String(item.id).toLowerCase()).catch(() => null);
                    if (existingTarget && isSuperAdminUser(existingTarget)) continue;
                }
                await db.setDoc(table, String(item.id), item);
                restored++;
            }
        }

        res.json({
            success: true,
            table,
            restoredCount: restored,
            readTimeMs,
            message: `Restored ${restored} records into "${table}" from Apache Parquet in ${readTimeMs}ms!`
        });
    } catch (error: any) {
        console.error("[PARQUET] Restore error:", error);
        res.status(500).json({ error: "Failed to parse or restore .parquet file", details: error.message });
    }
});

// ============================================================================
// Enterprise JSON-RPC 2.0 External ERP Bridge & Self-Hosted Integration
// ============================================================================
app.get("/api/rpc-bridge/config", authenticate, async (req, res) => {
    try {
        const saved = await db.getDoc("erp_integrations", "rpc_bridge").catch(() => null);
        res.json({
            configured: Boolean(saved?.url && saved?.db && saved?.username),
            url: saved?.url || "http://localhost:8069",
            db: saved?.db || "rmg_wash_erp",
            username: saved?.username || "admin",
            hasPassword: Boolean(saved?.password),
            serverVersion: saved?.serverVersion || null,
            installedModules: saved?.installedModules || [],
            lastSyncAt: saved?.lastSyncAt || null,
        });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to load RPC configuration", details: error.message });
    }
});

app.post("/api/rpc-bridge/config", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const { url, db: rpcDbName, username, password } = req.body;
        if (!url || !rpcDbName || !username || !password) {
            return res.status(400).json({ error: "URL, Database name, Username, and Password/API Key are required." });
        }

        const config: RpcConnectionConfig = {
            url: String(url).trim(),
            db: String(rpcDbName).trim(),
            username: String(username).trim(),
            password: String(password),
        };

        const authResult = await authenticateRpcServer(config);

        await db.setDoc("erp_integrations", "rpc_bridge", {
            id: "rpc_bridge",
            ...config,
            uid: authResult.uid,
            serverVersion: authResult.serverVersion,
            installedModules: authResult.modules.slice(0, 30),
            lastSyncAt: new Date().toISOString(),
        });

        res.json({
            success: true,
            uid: authResult.uid,
            serverVersion: authResult.serverVersion,
            installedModules: authResult.modules,
            message: `Connected (${authResult.serverVersion}) via JSON-RPC!`,
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Could not connect to JSON-RPC server" });
    }
});

app.post("/api/rpc-bridge/sync/push", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const saved = await db.getDoc("erp_integrations", "rpc_bridge");
        if (!saved?.url || !saved?.db || !saved?.username || !saved?.password) {
            return res.status(400).json({ error: "Connect your JSON-RPC server first." });
        }

        const config: RpcConnectionConfig = {
            url: saved.url,
            db: saved.db,
            username: saved.username,
            password: saved.password,
        };
        const { uid } = await authenticateRpcServer(config);

        const orders = await db.getDocs("erp_orders").catch(() => []);
        const buyerNames = orders.map((o: any) => o.buyer).filter(Boolean);
        const partnerStats = await pushBuyersToRpc(config, uid, buyerNames);

        await db.setDoc("erp_integrations", "rpc_bridge", {
            ...saved,
            lastSyncAt: new Date().toISOString(),
        });

        res.json({
            success: true,
            partnerStats,
            message: `Pushed buyers to res.partner (${partnerStats.created} created, ${partnerStats.existing} already existed).`,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "RPC push sync failed" });
    }
});

app.post("/api/rpc-bridge/sync/pull", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const model = String(req.body?.model || "res.partner") as any;
        const allowed = ["res.partner", "mrp.production", "purchase.order", "hr.employee", "maintenance.equipment"];
        if (!allowed.includes(model)) {
            return res.status(400).json({ error: `Unsupported RPC model "${model}"` });
        }

        const saved = await db.getDoc("erp_integrations", "rpc_bridge");
        if (!saved?.url || !saved?.db || !saved?.username || !saved?.password) {
            return res.status(400).json({ error: "Connect your JSON-RPC server first." });
        }

        const config: RpcConnectionConfig = {
            url: saved.url,
            db: saved.db,
            username: saved.username,
            password: saved.password,
        };
        const { uid } = await authenticateRpcServer(config);
        const records = await pullRpcRecords(config, uid, model, 100);

        let imported = 0;
        const targetMap: Record<string, string> = {
            "res.partner": "erp_crm_leads",
            "mrp.production": "erp_work_orders",
            "purchase.order": "erp_rfqs",
            "hr.employee": "erp_employees",
            "maintenance.equipment": "erp_maintenance",
        };
        const targetCol = targetMap[model];

        for (const rec of records) {
            const docId = `rpc_${model.replace(/\./g, "_")}_${rec.id}`;
            await db.setDoc(targetCol, docId, {
                id: docId,
                external_id: rec.id,
                external_model: model,
                name: rec.name,
                title: rec.name,
                customer_name: rec.name,
                bom_name: rec.name,
                qty_to_produce: rec.product_qty || 0,
                status: rec.state || "Active",
                email: rec.email || rec.work_email || "",
                job_title: rec.job_title || "",
                synced_from_rpc: true,
                synced_at: new Date().toISOString(),
            });
            imported++;
        }

        res.json({
            success: true,
            model,
            targetCollection: targetCol,
            importedCount: imported,
            records,
            message: `Pulled ${imported} records (${model}) into ${targetCol}.`,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "RPC pull sync failed" });
    }
});

app.get("/api/rpc-bridge/docker-compose", authenticate, (req, res) => {
    const port = Number(req.query?.port) || 3000;
    const pgPass = String(req.query?.pgPass || "rmg_wash_pg_secret");
    const yaml = generateErpDockerCompose({ httpPort: port, pgPass });
    res.setHeader("Content-Disposition", 'attachment; filename="docker-compose.rmg-erp.yml"');
    res.setHeader("Content-Type", "text/yaml");
    res.send(yaml);
});

app.get("/api/admin/users", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const users = await db.getDocs("users");
        const sanitizedUsers = users.map(user => {
            const { password_hash, ...rest } = user;
            return rest;
        });
        res.json(sanitizedUsers);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.post("/api/admin/users", authenticate, authorize(["admin"]), async (req, res) => {
    const { username, password, role } = req.body || {};
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedRole = String(role || "").trim().toLowerCase();
    if (!normalizedUsername || !password || !normalizedRole) return res.status(400).json({ error: "Missing fields" });

    if (String(password).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const currentUser = (req as any).user;
    const isSuperAdmin = isSuperAdminUser(currentUser);

    if (normalizedRole === "super_admin") {
        return res.status(403).json({ error: "Super User (super_admin) role is reserved strictly for first-time initial setup." });
    }

    // Only Super User can create other System Admin accounts
    if (normalizedRole === "admin" && !isSuperAdmin) {
        return res.status(403).json({ error: "Only the Super User (super_admin) can create Admin accounts." });
    }

    try {
        const existingUser = await db.getDoc("users", normalizedUsername);
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(String(password), 10);
        await db.setDoc("users", normalizedUsername, {
            id: normalizedUsername,
            username: normalizedUsername,
            password_hash: hashedPassword,
            role: normalizedRole,
            status: "active",
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to create user" });
    }
});

app.patch("/api/admin/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    const { id } = req.params;
    const { role, status, password } = req.body || {};
    
    const currentUser = (req as any).user;
    const isSuperAdmin = isSuperAdminUser(currentUser);
    const targetUserId = id.toLowerCase();
    const normalizedRole = role ? String(role).trim().toLowerCase() : undefined;

    if (password !== undefined && String(password).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    try {
        const targetUser = await db.getDoc("users", targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // 1. Strictly forbid blocking, modifying, or overriding the Super User profile
        if (isSuperAdminUser(targetUser)) {
            return res.status(403).json({ error: "The Super User (super_admin) account is protected and cannot be modified or deactivated here." });
        }

        if (normalizedRole === "super_admin") {
            return res.status(403).json({ error: "Cannot assign super_admin role to additional users." });
        }

        // 2. Only Super User can modify other Admin accounts
        if (targetUser.role === "admin" && !isSuperAdmin) {
            return res.status(403).json({ error: "Only the Super User (super_admin) can modify Admin accounts." });
        }

        // 3. Only Super User can promote someone to Admin
        if (normalizedRole === "admin" && !isSuperAdmin) {
            return res.status(403).json({ error: "Only the Super User (super_admin) can promote users to Admin." });
        }

        const passwordHash = password ? await bcrypt.hash(String(password), 10) : undefined;

        await db.updateDoc("users", targetUserId, {
            ...(normalizedRole && { role: normalizedRole }),
            ...(status && { status }),
            ...(passwordHash && { password_hash: passwordHash }),
            updated_at: new Date().toISOString()
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete("/api/admin/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    const { id } = req.params;
    
    const currentUser = (req as any).user;
    const isSuperAdmin = isSuperAdminUser(currentUser);
    const targetUserId = id.toLowerCase();

    try {
        const targetUser = await db.getDoc("users", targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // 1. Super User cannot be deleted
        if (isSuperAdminUser(targetUser)) {
            return res.status(403).json({ error: "Super User (super_admin) cannot be deleted." });
        }

        // 2. Only Super User can delete Admin accounts
        if (targetUser.role === "admin" && !isSuperAdmin) {
            return res.status(403).json({ error: "Only the Super User (super_admin) can delete Admin accounts." });
        }

        await db.deleteDoc("users", targetUserId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Deletion failed" });
    }
});

// ERP API
app.post("/api/erp/upload", authenticate, authorize(["admin", "editor"]), upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    
    // Find the actual header row index by scanning for 'Buyer'
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
        const rowStr = Array.isArray(data[i]) ? data[i].join("").toLowerCase() : "";
        if (rowStr.includes("buyer")) {
            headerRowIndex = i;
            break;
        }
    }

    // Improved mapping with header detection
    const headers = data[headerRowIndex].map((h: any) => String(h || "").toLowerCase().trim());
    
    const findCol = (possibleNames: string[]) => {
      const idx = headers.findIndex(h => possibleNames.some(name => h.includes(name.toLowerCase())));
      return idx;
    };

    const colMap = {
      buyer: findCol(['buyer']),
      shipDate: findCol(['ship date', 'erp date', 'date']),
      fileNo: findCol(['file', 'job ref', 'file no']),
      styleNo: findCol(['style']),
      color: findCol(['color', 'item', 'item list']),
      cplQty: findCol(['cpl qty', 'cpl']),
      orderQty: findCol(['order qty', 'qty']),
      floor: findCol(['floor', 'sew floor']),
      washType: findCol(['wash type', 'type of wash']),
      status: findCol(['status', 'wash status']),
      plan: findCol(['plan', 'p.p/ plan']),
      remarks: findCol(['remarks', '1st tod', 'remark']),
      printEmb: findCol(['print', 'emb']),
      sourceRef: findCol(['source'])
    };

    const rows = data.slice(headerRowIndex + 1).map((row: any) => {
      const getValue = (idx: number) => idx !== -1 ? String(row[idx] || "").trim() : "";
      
      return {
        buyer: getValue(colMap.buyer),
        erp_ship_date: getValue(colMap.shipDate),
        erp_date: getValue(colMap.shipDate),
        file_no: getValue(colMap.fileNo),
        style_no: getValue(colMap.styleNo),
        color: getValue(colMap.color),
        item: getValue(colMap.color),
        cpl_qty_kg: Number(getValue(colMap.cplQty).replace(/,/g, "")) || 0,
        order_qty: Number(getValue(colMap.orderQty).replace(/,/g, "")) || 0,
        floor: getValue(colMap.floor),
        sew_floor: getValue(colMap.floor),
        wash_type: getValue(colMap.washType),
        status: getValue(colMap.status) || "New",
        plan: getValue(colMap.plan),
        print_emb: getValue(colMap.printEmb),
        source_ref: getValue(colMap.sourceRef),
        remarks: getValue(colMap.remarks)
      };
    }).filter(row => row.buyer && row.file_no);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to parse Excel file" });
  }
});

// ProactivePlan: Cloud-Based AI Apparel Planning Solution (FreeModel / Gemini / CPM)
app.post("/api/ai/proactive-plan", authenticate, async (req, res) => {
    try {
        const { orders, provider, freemodelApiKey, freemodelEndpoint, freemodelModel, options } = req.body;
        let ordersToPlan = orders;
        if (!ordersToPlan || !Array.isArray(ordersToPlan) || ordersToPlan.length === 0) {
            ordersToPlan = await db.getDocs("erp_orders");
        }
        const plan = await generateProactivePlan({
            orders: ordersToPlan,
            provider,
            freemodelApiKey,
            freemodelEndpoint,
            freemodelModel,
            options
        });
        
        // Cache plan as latest in DB
        await db.setDoc("proactive_plans", "latest", plan).catch(() => {});
        res.json(plan);
    } catch (error: any) {
        console.error("[AI] Error generating proactive plan:", error);
        res.status(500).json({ error: error.message || "Failed to generate AI plan" });
    }
});

app.get("/api/ai/proactive-plan/latest", authenticate, async (req, res) => {
    try {
        const plan = await db.getDoc("proactive_plans", "latest");
        if (!plan) return res.status(404).json({ error: "No saved plan found" });
        res.json(plan);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/ai/scenario-simulate", authenticate, async (req, res) => {
    try {
        const { prompt, orders, currentPlan, provider, freemodelApiKey, freemodelEndpoint, freemodelModel } = req.body;
        if (!prompt) return res.status(400).json({ error: "Scenario prompt is required" });
        let ordersList = orders;
        if (!ordersList || !Array.isArray(ordersList)) {
            ordersList = await db.getDocs("erp_orders");
        }
        const result = await simulatePlanningScenario({
            prompt,
            orders: ordersList,
            currentPlan,
            provider,
            freemodelApiKey,
            freemodelEndpoint,
            freemodelModel
        });
        res.json(result);
    } catch (error: any) {
        console.error("[AI] Error simulating scenario:", error);
        res.status(500).json({ error: error.message || "Failed to simulate scenario" });
    }
});

// Generic Database API & Core Aliases
app.get("/api/orders", authenticate, async (req, res) => {
    try {
        const data = await db.getDocs("erp_orders");
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/db/:collection", authenticate, async (req, res) => {
    try {
        const data = await db.getDocs(req.params.collection);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/db/:collection/:id", authenticate, async (req, res) => {
    try {
        const data = await db.getDoc(req.params.collection, req.params.id);
        if (!data) return res.status(404).json({ error: "Not found" });
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/db/:collection", authenticate, async (req, res) => {
    try {
        const id = await db.addDoc(req.params.collection, req.body);
        res.status(201).json({ id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.patch("/api/db/:collection/:id", authenticate, async (req, res) => {
    try {
        await db.updateDoc(req.params.collection, req.params.id, req.body);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/db/:collection/:id", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        await db.deleteDoc(req.params.collection, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/db/batch/:collection", authenticate, async (req, res) => {
    try {
        const { operations } = req.body;
        if (!Array.isArray(operations)) return res.status(400).json({ error: "Operations must be an array" });
        
        for (const op of operations) {
            if (op.type === 'set') {
                await db.setDoc(req.params.collection, op.id, op.data);
            }
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.use((err: any, req: any, res: any, next: any) => {
    console.error("[EXPRESS] Unhandled route error:", err);
    if (res.headersSent) return next(err);
    res.status(err?.status || 500).json({
        error: err?.message || "Internal server error"
    });
});

async function startServer() {
    console.log("[SERVER] Initializing...");
    const httpServer = http.createServer(app);

    // Trigger seeding lazily on startup, but do not block node server initialization
    getSeedPromise().catch((err) => {
        console.warn("[SERVER] Non-critical database initialization notice during startup:", err.message);
    });

    const isProd = process.env.NODE_ENV === "production";
    const isCompiledStart = Boolean(process.argv[1]?.endsWith("server.cjs"));
    const distPath = path.join(process.cwd(), "dist");
    const distIndexExists = fs.existsSync(path.join(distPath, "index.html"));

    if ((isProd || isCompiledStart) && distIndexExists) {
        console.log("[SERVER] Mode: Production static bundle");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            if (req.originalUrl.startsWith("/api/")) {
                return res.status(404).json({ error: "API endpoint not found" });
            }
            res.sendFile(path.join(distPath, "index.html"));
        });
    } else {
        console.log("[SERVER] Mode: Vite Dev Middleware with SPA fallback");
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { 
                middlewareMode: true,
                hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer }
            },
            appType: "custom",
        });
        app.use(vite.middlewares);

        // Catch-all SPA handler for dev mode to ensure all routes (/login, /cpl-report, etc.) serve index.html
        app.use("*", async (req, res, next) => {
            const url = req.originalUrl;
            if (url.startsWith("/api/")) {
                return res.status(404).json({ error: "API endpoint not found" });
            }
            try {
                const indexPath = path.resolve(process.cwd(), "index.html");
                let template = fs.readFileSync(indexPath, "utf-8");
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ "Content-Type": "text/html" }).end(template);
            } catch (e: any) {
                vite.ssrFixStacktrace(e);
                next(e);
            }
        });
    }

    httpServer.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
            console.error(`[SERVER] ⚠️ Port ${PORT} already in use. Retrying or binding to existing handle.`);
        } else {
            console.error("[SERVER] HTTP Server error:", err);
        }
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

if (!process.env.VERCEL) {
    startServer();
}
export default app;
