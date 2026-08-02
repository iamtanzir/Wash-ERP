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
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        
        const tanzirUser = await db.getDoc("users", "tanzirerp");
        if (!tanzirUser) {
            console.log("[SEED] Super Admin tanzirerp missing, creating default...");
            const hashedPassword = await bcrypt.hash("tanziradmin", 10);
            await db.setDoc("users", "tanzirerp", {
                username: "tanzirerp",
                password_hash: hashedPassword,
                role: "admin",
                status: "active",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        console.log("[DB] Database connection verified.");
    } catch (err: any) {
        console.error("[DB] ❌ Database connection failed during startup.");
        console.error(`[DB] Error detail: ${err.message}`);
        // We don't throw here to allow the server to start and Vite to serve the frontend
        // Error feedback will be provided in the Login page when users try to interact.
    }

    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
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
