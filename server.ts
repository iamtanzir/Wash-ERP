import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import http from "http";
import { createServer as createViteServer } from "vite";
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

let db = getDatabase();
const app = express();

let dbSeedPromise: Promise<void> | null = null;

async function seedDatabase() {
    console.log("[SEED] Checking database connection and seeding...");
    const adminUser = await db.getDoc("users", "admin");
    if (!adminUser) {
        console.log("[SEED] Admin missing, creating default...");
        const hashedPassword = await bcrypt.hash("admin", 10);
        await db.setDoc("users", "admin", {
            id: "admin",
            username: "admin",
            password_hash: hashedPassword,
            role: "admin",
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    
    const tanzirUser = await db.getDoc("users", "tanzirerp");
    if (!tanzirUser) {
        console.log("[SEED] Super Admin tanzirerp missing, creating default...");
        const hashedPassword = await bcrypt.hash("tanziradmin", 10);
        await db.setDoc("users", "tanzirerp", {
            id: "tanzirerp",
            username: "tanzirerp",
            password_hash: hashedPassword,
            role: "admin",
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    console.log("[SEED] Database seeding check completed.");
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

const httpServer = http.createServer(app);
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET_KEY = process.env.JWT_SECRET || "inctl-internal-security-secret-key-2024";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_KEY);

app.use(express.json());
app.use(cookieParser(JWT_SECRET_KEY));

// Health check API endpoint (First API route for container/proxy health checks)
app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use(ensureDb);

// Middleware: Auth Check
const authenticate = async (req: any, res: any, next: any) => {
    const token = req.cookies.auth_token;
    
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
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
        next();
    };
};

const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (!req.user || req.user.username?.toLowerCase() !== "tanzirerp") {
        return res.status(403).json({ error: "Forbidden: Host & Cloud Admin access is restricted to Super Admin (tanzirerp)" });
    }
    next();
};

// API: Login
const handleLogin = async (req: any, res: any) => {
    const { username, password } = req.body;
    
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

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
            maxAge: 24 * 60 * 60 * 1000 // 24h
        });

        res.json({
            success: true,
            user: {
                id: userData.id,
                username: userData.username,
                role: userData.role
            }
        });

        try {
            await db.addDoc("audit_logs", {
                action: "login",
                userId: userData.id,
                ip: req.ip
            });
        } catch (auditErr) {
            console.error("Audit log failed:", auditErr);
        }

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

app.post("/api/login", handleLogin);
app.post("/api/auth/login", handleLogin);

app.post("/api/logout", (req, res) => {
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/"
    });
    res.json({ success: true });
});

app.get("/api/time", (req, res) => { res.json({ time: Date.now() }); });

app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
});

// User Management API
app.post("/api/admin/config/turso", authenticate, requireSuperAdmin, async (req, res) => {
    const { url, token } = req.body;
    if (!url || !token) return res.status(400).json({ error: "Missing fields" });

    try {
        process.env.TURSO_DATABASE_URL = url;
        process.env.TURSO_AUTH_TOKEN = token;
        
        res.cookie("turso_url", url, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });
        res.cookie("turso_token", token, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });

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

        const localDbPath = path.resolve(process.env.LOCAL_DB_PATH || process.env.SQLITE_PATH || "./data/erp_database.sqlite");
        let dbFileExists = false;
        let dbFileSize = 0;
        try {
            if (fs.existsSync(localDbPath)) {
                dbFileExists = true;
                const stats = fs.statSync(localDbPath);
                dbFileSize = stats.size;
            }
        } catch (e) {}

        const backupDir = path.resolve("./data/gdrive_backups");
        let backupCount = 0;
        try {
            if (fs.existsSync(backupDir)) {
                backupCount = fs.readdirSync(backupDir).filter(f => f.endsWith(".json")).length;
            }
        } catch (e) {}

        let publicOnlineUrl = process.env.PUBLIC_ONLINE_URL || process.env.CLOUDFLARE_TUNNEL_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
        const onlineConfigPath = path.resolve("./data/online_config.json");
        if (!publicOnlineUrl && fs.existsSync(onlineConfigPath)) {
            try {
                const conf = JSON.parse(fs.readFileSync(onlineConfigPath, "utf-8"));
                publicOnlineUrl = conf.publicUrl || "";
            } catch (e) {}
        }

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
    const onlineConfigPath = path.resolve("./data/online_config.json");
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
        const onlineConfigPath = path.resolve("./data/online_config.json");
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

// Database Mode Switcher (Local SQLite, Google Drive Sync, Turso, Memory - Super Admin Only)
app.post("/api/admin/config/db-mode", authenticate, requireSuperAdmin, async (req, res) => {
    const { mode, localPath } = req.body;
    if (!mode) return res.status(400).json({ error: "Database mode is required" });

    try {
        process.env.DATABASE_MODE = mode;
        res.cookie("db_mode", mode, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });

        if (localPath) {
            process.env.LOCAL_DB_PATH = localPath;
            process.env.SQLITE_PATH = localPath;
            process.env.GDRIVE_DB_PATH = localPath;
            res.cookie("local_db_path", localPath, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 1000 * 60 * 60 * 24 * 365 });
        }

        db = getDatabase();
        dbSeedPromise = null;
        await getSeedPromise();

        res.json({ 
            success: true, 
            message: `Database switched to ${mode.toUpperCase()} mode successfully.`,
            mode,
            localPath: process.env.LOCAL_DB_PATH || "./data/erp_database.sqlite"
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
                        // Protect super admin if already exists or preserve integrity
                        if (col === "users" && item.username === "tanzirerp") {
                            const existingTanzir = await db.getDoc("users", "tanzirerp");
                            if (existingTanzir) {
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
        const backupDir = path.resolve("./data/gdrive_backups");
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
        const backupDir = path.resolve("./data/gdrive_backups");
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
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: "Missing fields" });

    const currentUser = (req as any).user;
    const isSuperAdmin = currentUser.username.toLowerCase() === "tanzirerp";

    // Only Super Admin can create other admin accounts
    if (role === "admin" && !isSuperAdmin) {
        return res.status(403).json({ error: "Only Super Admin (tanzirerp) can create Admin accounts." });
    }

    try {
        const existingUser = await db.getDoc("users", username.toLowerCase());
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.setDoc("users", username.toLowerCase(), {
            username: username.toLowerCase(),
            password_hash: hashedPassword,
            role,
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
    const { role, status } = req.body;
    
    const currentUser = (req as any).user;
    const isSuperAdmin = currentUser.username.toLowerCase() === "tanzirerp";
    const targetUserId = id.toLowerCase();

    // 1. Strictly forbid blocking, modifying, or overriding the Super Admin profile
    if (targetUserId === "tanzirerp") {
        return res.status(403).json({ error: "No user is allowed to block, modify or override Super Admin (tanzirerp)." });
    }

    try {
        const targetUser = await db.getDoc("users", targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // 2. Only Super Admin can modify other Admin accounts
        if (targetUser.role === "admin" && !isSuperAdmin) {
            return res.status(403).json({ error: "Only Super Admin (tanzirerp) can modify Admin accounts." });
        }

        // 3. Only Super Admin can promote someone to Admin
        if (role === "admin" && !isSuperAdmin) {
            return res.status(403).json({ error: "Only Super Admin (tanzirerp) can promote users to Admin." });
        }

        await db.updateDoc("users", targetUserId, {
            ...(role && { role }),
            ...(status && { status })
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete("/api/admin/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    const { id } = req.params;
    
    const currentUser = (req as any).user;
    const isSuperAdmin = currentUser.username.toLowerCase() === "tanzirerp";
    const targetUserId = id.toLowerCase();

    // 1. Super Admin cannot be deleted
    if (targetUserId === "tanzirerp") {
        return res.status(403).json({ error: "Super Admin (tanzirerp) cannot be deleted." });
    }

    try {
        const targetUser = await db.getDoc("users", targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // 2. Only Super Admin can delete Admin accounts
        if (targetUser.role === "admin" && !isSuperAdmin) {
            return res.status(403).json({ error: "Only Super Admin (tanzirerp) can delete Admin accounts." });
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

// Generic Database API
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

async function startServer() {
    console.log("[SERVER] Initializing...");

    // Trigger seeding lazily on startup, but do not block node server initialization
    getSeedPromise().catch((err) => {
        console.warn("[SERVER] Non-critical database initialization notice during startup:", err.message);
    });

    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
        const vite = await createViteServer({
            server: { 
                middlewareMode: true,
                hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer }
            },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    if (!process.env.VERCEL) {
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
}

startServer();
export default app;
