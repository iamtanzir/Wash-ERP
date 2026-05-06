import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import admin from "firebase-admin";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
    getFirestore as getClientFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc,
    updateDoc,
    deleteDoc,
    query, 
    collection, 
    where, 
    limit, 
    getDocs, 
    orderBy,
    serverTimestamp,
    FieldValue as ClientFieldValue
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

// Initialize Firebase Admin (for other things if needed)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

// Initialize Client SDK (works better for Firestore in this environment)
const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = "inctl-internal-security-secret-key-2024";

app.use(express.json());
app.use(cookieParser(JWT_SECRET)); // Use secret for signed cookies

// Seeding: Default Admin
const seedAdmin = async () => {
    try {
        console.log(`[SEED] Checking admin in db: ${firebaseConfig.firestoreDatabaseId} using Client SDK`);
        const adminRef = doc(db, "users", "admin");
        const docSnap = await getDoc(adminRef);
        if (!docSnap.exists()) {
            console.log("[SEED] Admin not found, creating...");
            const hashedPassword = await bcrypt.hash("admin", 10);
            await setDoc(adminRef, {
                username: "admin",
                password_hash: hashedPassword,
                role: "admin",
                status: "active",
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });
            console.log("[SEED] ✅ Default admin (admin/admin) seeded.");
        } else {
            console.log("[SEED] ℹ️ Admin user already exists.");
        }
    } catch (err: any) {
        console.error("[SEED] ❌ Error:", err.code, err.message);
    }
};
seedAdmin();

// Middleware: Auth Check
const authenticate = async (req: any, res: any, next: any) => {
    // Check both signed and unsigned for robustness during transition
    let session = req.signedCookies.session || req.cookies.session;
    
    if (!session) {
        console.warn(`[AUTH] No session cookie found for request: ${req.path}`);
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const userData = JSON.parse(session);
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
        const userRef = doc(db, "users", username.toLowerCase());
        const userDocSnap = await getDoc(userRef);
        
        if (!userDocSnap.exists()) return res.status(401).json({ error: "Invalid credentials" });
        const userData = userDocSnap.data()!;
        if (userData.status !== "active") return res.status(403).json({ error: "Account deactivated" });

        const validPassword = await bcrypt.compare(password, userData.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

        const sessionPayload = {
            id: userDocSnap.id,
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

        console.log(`[LOGIN] User ${username} successfully authenticated. Role: ${userData.role}`);
        console.log("[LOGIN] Session cookie set with SameSite=None; Secure; Path=/");

        res.json({
            success: true,
            user: sessionPayload
        });

        // Audit Log
        try {
            await addDoc(collection(db, "audit_logs"), {
                action: "login",
                userId: userDocSnap.id,
                timestamp: serverTimestamp(),
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
        const usersQuery = query(collection(db, "users"), orderBy("created_at", "desc"));
        const snapshot = await getDocs(usersQuery);
        const users = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            delete data.password_hash; // Security
            return { id: docSnap.id, ...data };
        });
        res.json(users);
    } catch (error) {
        console.error("Fetch users error:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.post("/api/admin/users", authenticate, authorize(["admin"]), async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: "Missing fields" });

    try {
        const userRef = doc(db, "users", username.toLowerCase());
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await setDoc(userRef, {
            username: username.toLowerCase(),
            password_hash: hashedPassword,
            role,
            status: "active",
            created_by: (req as any).user.id,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
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
        await updateDoc(doc(db, "users", req.user.id), {
            password_hash: hashedPassword,
            updated_at: serverTimestamp()
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
            const adminQuery = query(
                collection(db, "users"),
                where("role", "==", "admin"),
                where("status", "==", "active")
            );
            const adminSnapshot = await getDocs(adminQuery);
            
            if (adminSnapshot.size <= 1 && adminSnapshot.docs[0].id === id) {
                return res.status(400).json({ error: "System must have at least one active admin" });
            }
        }

        await updateDoc(doc(db, "users", id), {
            ...(role && { role }),
            ...(status && { status }),
            updated_at: serverTimestamp()
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
        const adminQuery = query(
            collection(db, "users"),
            where("role", "==", "admin"),
            where("status", "==", "active")
        );
        const adminSnapshot = await getDocs(adminQuery);
        
        if (adminSnapshot.size <= 1 && adminSnapshot.docs[0].id === id) {
            return res.status(400).json({ error: "Cannot delete the last active admin" });
        }

        await deleteDoc(doc(db, "users", id));
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

