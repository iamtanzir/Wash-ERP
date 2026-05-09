import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import pkgXLSX from "xlsx";
const XLSX = pkgXLSX;
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getDatabase } from "./src/server/db/index.js";

const db = getDatabase();
const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET_KEY = process.env.JWT_SECRET || "inctl-internal-security-secret-key-2024";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_KEY);

app.use(express.json());
app.use(cookieParser(JWT_SECRET_KEY));

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

// API: Login
const handleLogin = async (req: any, res: any) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        console.log(`[AUTH] Attempting login for: ${username}`);
        let userData = await db.getDoc("users", username.toLowerCase());
        
        // AUTO-SEED: If no admin exists and someone tries to log in as admin, create it now
        if (!userData && username.toLowerCase() === "admin") {
            console.log("[AUTH] Admin account missing, creating default admin/admin...");
            const hashedPassword = await bcrypt.hash("admin", 10);
            const newAdmin = {
                id: "admin",
                username: "admin",
                password_hash: hashedPassword,
                role: "admin",
                status: "active",
                created_at: new Date(),
                updated_at: new Date()
            };
            await db.setDoc("users", "admin", newAdmin);
            userData = newAdmin;
            console.log("[AUTH] Admin account created successfully.");
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

app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
});

// User Management API
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

    try {
        const existingUser = await db.getDoc("users", username.toLowerCase());
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.setDoc("users", username.toLowerCase(), {
            username: username.toLowerCase(),
            password_hash: hashedPassword,
            role,
            status: "active",
            created_by: (req as any).user.id,
            created_at: new Date(),
            updated_at: new Date()
        });
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to create user" });
    }
});

app.patch("/api/admin/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    const { id } = req.params;
    const { role, status } = req.body;
    try {
        await db.updateDoc("users", id, {
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
    try {
        await db.deleteDoc("users", id);
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
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    
    // Find the actual header row index by scanning for 'Buyer'
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
        const rowStr = Array.isArray(data[i]) ? data[i].join("").toLowerCase() : "";
        if (rowStr.includes("buyer")) {
            headerRowIndex = i;
            break;
        }
    }

    const rows = data.slice(headerRowIndex + 1).map((row: any) => {
      // Map columns based on assumed typical Next plan layout
      // A: Buyer (0)
      // B: ERP Ship Date (1)
      // C: Job Ref / File Name (2)
      // D: Style No / Developing Name (3)
      // E: CPL Qty (4)
      // F: Order Qty (5)
      // G: Sew Floor (6)
      // H: Item List / Color (7)
      // I: Wash Type (8)
      // J: Wash Status (9)
      // K: Plan (10)
      // L: Print/Emb (11)
      // M: Source Ref (12)
      // N: Remarks (13)
      return {
        buyer: String(row[0] || "").trim(),
        erp_ship_date: String(row[1] || "").trim(),
        file_no: String(row[2] || "").trim(),
        style_no: String(row[3] || "").trim(),
        cpl_qty_kg: Number(String(row[4]).replace(/,/g, "")) || 0,
        order_qty: Number(String(row[5]).replace(/,/g, "")) || 0,
        floor: String(row[6] || "").trim(),
        color: String(row[7] || "").trim(), // Treat item list as color/item interchangeably
        item: String(row[7] || "").trim(),
        wash_type: String(row[8] || "").trim(),
        status: String(row[9] || "New").trim(),
        plan: String(row[10] || "").trim(),
        print_emb: String(row[11] || "").trim(),
        source_ref: String(row[12] || "").trim(),
        remarks: String(row[13] || "").trim()
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
    try {
        console.log("[SERVER] Checking database connection...");
        const adminUser = await db.getDoc("users", "admin");
        if (!adminUser) {
            console.log("[SEED] Admin missing, creating default...");
            const hashedPassword = await bcrypt.hash("admin", 10);
            await db.setDoc("users", "admin", {
                username: "admin",
                password_hash: hashedPassword,
                role: "admin",
                status: "active",
                created_at: new Date(),
                updated_at: new Date()
            });
        }
        console.log("[DB] Database connection verified.");
    } catch (err: any) {
        console.error("[DB] ❌ Database connection failed during startup.");
        console.error(`[DB] Error detail: ${err.message}`);
        // We don't throw here to allow the server to start and Vite to serve the frontend
        // Error feedback will be provided in the Login page when users try to interact.
    }

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
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
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
}

startServer();
export default app;
