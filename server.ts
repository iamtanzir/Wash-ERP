import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { getDatabase } from "./src/server/db/index.ts";

const db = getDatabase();
console.log(`[SEED] Database Adapter Class: ${db.constructor.name}`);
const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = "inctl-internal-security-secret-key-2024";

app.use(express.json());
app.use(cookieParser(JWT_SECRET)); // Use secret for signed cookies

// Seeding: Default Admin
const seedAdmin = async () => {
    try {
        console.log(`[SEED] Starting seeding... Database Type: ${db.constructor.name}`);
        console.log(`[SEED] Checking admin in db...`);
        const adminUser = await db.getDoc("users", "admin");
        if (!adminUser) {
            console.log("[SEED] Admin not found, creating account...");
            const hashedPassword = await bcrypt.hash("admin", 10);
            await db.setDoc("users", "admin", {
                username: "admin",
                password_hash: hashedPassword,
                role: "admin",
                status: "active",
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log("[SEED] ✅ Default admin (admin/admin) seeded successfully.");
        } else {
            console.log("[SEED] ℹ️ Admin user already exists. Status:", adminUser.status);
        }
    } catch (err: any) {
        console.error("[SEED] ❌ Error:", err.message);
    }
};
seedAdmin();

// Middleware: Auth Check
const authenticate = async (req: any, res: any, next: any) => {
    let session = req.signedCookies.session || req.cookies.session;
    
    if (!session) {
        console.warn(`[AUTH] No session cookie found for request: ${req.path}`);
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const userData = typeof session === 'string' ? JSON.parse(session) : session;
        req.user = userData;
        next();
    } catch (error) {
        console.error("[AUTH] Failed to parse session cookie:", error);
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
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    try {
        console.log(`[LOGIN] Attempt: username="${username}"`);
        const userData = await db.getDoc("users", username.toLowerCase());
        
        if (!userData) {
            console.log(`[LOGIN] User "${username.toLowerCase()}" not found in DB`);
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        console.log(`[LOGIN] Found user record: id="${userData.id}", user="${userData.username}", status="${userData.status}"`);
        
        if (userData.status !== "active") {
            console.log(`[LOGIN] User is inactive`);
            return res.status(403).json({ error: "Account deactivated" });
        }

        const validPassword = await bcrypt.compare(password, userData.password_hash);
        console.log(`[LOGIN] Password comparison result: ${validPassword}`);
        
        if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

        const sessionPayload = {
            id: userData.id,
            username: userData.username,
            role: userData.role
        };

        res.cookie("session", JSON.stringify(sessionPayload), {
            httpOnly: true,
            secure: true, 
            sameSite: "none",
            path: "/",
            maxAge: 24 * 60 * 60 * 1000 // 24h
        });

        console.log(`[LOGIN] Auth Success for ${username}`);

        res.json({
            success: true,
            user: sessionPayload
        });

        // Audit Log
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
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
});

app.post("/api/logout", (req, res) => {
    res.clearCookie("session", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/"
    });
    res.json({ success: true });
});

app.get("/api/me", authenticate, (req: any, res) => {
    console.log(`[AUTH] Validating session for: ${req.user?.username} (${req.user?.role})`);
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
        console.error("Fetch users error:", error);
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

// Update Password (Force Change)
app.post("/api/update-password", authenticate, async (req: any, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.updateDoc("users", req.user.id, {
            password_hash: hashedPassword
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to update password" });
    }
});

// Update User (admin only)
app.patch("/api/admin/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    const { id } = req.params;
    const { role, status } = req.body;
    
    if ((req as any).user.id === id && role && role !== "admin") {
        return res.status(400).json({ error: "Admins cannot remove their own admin role" });
    }

    try {
        if (status === "inactive" || role !== "admin") {
            const users = await db.getDocs("users");
            const activeAdmins = users.filter(u => u.role === "admin" && u.status === "active");
            
            if (activeAdmins.length <= 1 && activeAdmins[0].id === id) {
                return res.status(400).json({ error: "System must have at least one active admin" });
            }
        }

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

    if ((req as any).user.id === id) {
        return res.status(400).json({ error: "You cannot delete yourself" });
    }

    try {
        const users = await db.getDocs("users");
        const activeAdmins = users.filter(u => u.role === "admin" && u.status === "active");
        
        if (activeAdmins.length <= 1 && activeAdmins[0].id === id) {
            return res.status(400).json({ error: "Cannot delete the last active admin" });
        }

        await db.deleteDoc("users", id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Deletion failed" });
    }
});

// API Routes
app.post("/api/erp/upload", authenticate, authorize(["admin", "editor"]), upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const rows = data.slice(1).map((row: any) => {
      return {
        buyer: row[0] || "",
        erp_ship_date: row[1] || "",
        file_name: row[2] || "",
        style_no: row[3] || "",
        cpl_qty_kg: Number(String(row[4]).replace(/,/g, "")) || 0,
        order_qty_pcs: Number(String(row[5]).replace(/,/g, "")) || 0,
        floor: row[6] || "",
        wash_type: row[7] || "",
        status: row[8] || "New",
        plan: row[9] || "",
        source_ref: row[10] || "",
        remarks: row[11] || ""
      };
    }).filter(row => row.buyer && row.file_name);

    res.json({ 
      success: true, 
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to parse Excel file" });
  }
});

async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

