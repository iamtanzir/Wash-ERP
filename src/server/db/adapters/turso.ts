import * as libsql from "@libsql/client";
import type { Client } from "@libsql/client";
const { createClient } = (libsql as any).default || libsql;
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.js";
import { MemoryAdapter } from "./memory.js";

export class TursoAdapter implements DatabaseAdapter {
  private client: Client;
  private initPromise: Promise<void>;
  private url: string;
  private fallbackMemory = new MemoryAdapter();
  private hasError = false;
  private CORE_TABLES = ['users', 'erp_orders', 'daily_logs', 'buyer_data_bank', 'audit_logs'];
  private ensuredTables = new Set<string>();

  constructor() {
    let url = process.env.TURSO_DATABASE_URL || "libsql://database-aureolin-zebra-vercel-icfg-3u3w3vvbm3v8uvyu7ik2a9pf.aws-ap-south-1.turso.io";
    let authToken = process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODU1MTUzOTEsImlkIjoiMDE5ZmI5MDItYjkwMS03NWJjLWEzZTEtOWFlNDI1NTYxYWQxIiwia2lkIjoiVWVoRWVGMFBOclI0ck05aTNkbVZyVVlSaWRWa3ozWnhFcE94em1rZGFDWSIsInJpZCI6IjY4YTBhMDJmLWU3MjgtNDJjNy1hYTg0LTE4MDZkNWZlNDY1OCJ9.Sj_iIfEUvIW_efZkYsLym4IEG7y35gYbNe830gMd82IZSGST5xF5_OWgJA3vj_MasJ3ZXjJPsObhc4V7y2jKAQ";

    // Sanitize URLs that might be wrapped in quotes or have whitespace
    url = (url || "").trim().replace(/^['"](.*)['"]$/, '$1').replace(/\/+$/, "").replace(/\s+/g, ""); // Remove trailing slashes and ALL whitespace
    authToken = (authToken || "").trim().replace(/^['"](.*)['"]$/, '$1').replace(/\s+/g, "");

    // Handle common misconfiguration: User pasting the dashboard URL instead of connection URL
    if (url.includes("turso.io/")) {
      const parts = url.split("/");
      const orgIndex = parts.indexOf("organizations");
      const dbIndex = parts.indexOf("databases");
      const projIndex = parts.indexOf("projects");
      
      let dbName = "";
      let orgName = "";

      if (orgIndex !== -1 && parts[orgIndex + 1]) {
        orgName = parts[orgIndex + 1].split(/[?#]/)[0].replace(/_/g, "-");
      } 

      if (dbIndex !== -1 && parts[dbIndex + 1]) {
        dbName = parts[dbIndex + 1].split(/[?#]/)[0].replace(/_/g, "-");
      }
      
      // Special case for dashboard URLs
      if (url.startsWith("https://") && (orgIndex !== -1 || projIndex !== -1) && dbIndex !== -1) {
        console.warn(`[TURSO] 🚨 Detected Dashboard URL instead of Connection URL.`);
        
        // If we don't have orgName but have projIndex, use that
        if (!orgName && projIndex !== -1 && parts[projIndex + 1]) {
           orgName = parts[projIndex + 1].split(/[?#]/)[0].replace(/_/g, "-");
        }

        if (dbName && orgName) {
            url = `libsql://${dbName}-${orgName}.turso.io`;
            console.warn(`[TURSO] 💡 Attempting auto-fix to: ${url}`);
        } else if (dbName) {
            console.warn(`[TURSO] ⚠️ Could not determine organization name from URL. Please copy the 'libsql://' URL from the 'Connect' tab.`);
        }
      }
    }

    // Handle common misconfiguration: User pasting 'libsql://' URL but accidentally prepending 'https://'
    if (url.startsWith("https://libsql://")) {
        url = url.replace("https://", "");
    }
    
    // Ensure we don't have double protocols
    if (url.startsWith("libsql://libsql://")) {
        url = url.replace("libsql://libsql://", "libsql://");
    }

    // Handle common misconfiguration: User pasting the whole variable assignment
    if (url.startsWith("TURSO_DATABASE_URL=")) {
      url = url.split("=")[1].trim().replace(/^['"](.*)['"]$/, '$1');
    }
    if (authToken.startsWith("TURSO_AUTH_TOKEN=")) {
      authToken = authToken.split("=")[1].trim().replace(/^['"](.*)['"]$/, '$1');
    }

    // Ensure URL doesn't have common mistakes
    if (url.includes("https://turso.io") && !url.includes(".turso.io/")) {
        console.error("[TURSO] 🚨 The URL points to the main Turso website, not your database instance.");
    }

    if (!url || !authToken) {
      console.warn("[TURSO] ⚠️ Missing or empty environment variables.");
    }

    // Ensure URL has protocol and is correctly formatted for the environment
    if (url && !url.includes("://") && !url.startsWith("http")) {
        url = `libsql://${url}`;
    }

    // Handle cases where the user pasted the URL with an embedded token but also provided the env var
    if (url.includes("authToken=") && authToken) {
        try {
            const urlObj = new URL(url.replace("libsql://", "http://"));
            if (urlObj.searchParams.has("authToken")) {
                console.warn("[TURSO] ⚠️ Auth token found in both URL and TURSO_AUTH_TOKEN. Prioritizing environment variable.");
                urlObj.searchParams.delete("authToken");
                url = urlObj.toString().replace("http://", "libsql://").replace(/\/$/, "");
            }
        } catch (e) {
            // Ignore URL parsing errors here
        }
    }
    
    // Check for common prefix mistakes
    if (url.startsWith("libsql://") && url.includes(".turso.io")) {
        // Correct format usually
    } else if (url && !url.includes(".turso.io") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
        console.warn(`[TURSO] ⚠️ The URL "${url}" does not look like a standard Turso URL.`);
    }
    
    // Only use https if explicitly requested or on Vercel
    if (url.startsWith("libsql://") && process.env.VERCEL) {
        console.log("[TURSO] 💡 Vercel environment detected, using https transport");
        url = url.replace("libsql://", "https://");
    }

    if (!url) {
      console.warn("[TURSO] ⚠️ TURSO_DATABASE_URL is missing. Database operations will fail.");
      // Fallback to a dummy URL to prevent createClient from throwing at load time
      url = "libsql://missing-url.turso.io";
    }

    const maskedUrl = url.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@").replace(/authToken=[^&]+/, "authToken=****");
    console.log(`[TURSO] 🔌 Connecting to: ${maskedUrl}`);
    this.url = url;

    try {
      this.client = createClient({
        url,
        authToken,
      });
    } catch (err: any) {
      console.error("[TURSO] 🚨 Failed to create client:", err.message);
      // Create a dummy client object to avoid type errors, but it will fail on use
      this.client = {
        execute: () => { throw new Error("Turso client not initialized correctly due to missing URL"); },
        batch: () => { throw new Error("Turso client not initialized correctly due to missing URL"); },
        close: () => {},
        sync: () => { throw new Error("Turso client not initialized correctly due to missing URL"); }
      } as any;
    }

    this.initPromise = this.init();
  }

  private async init() {
    const timeout = setTimeout(() => {
      console.warn("[TURSO] ⏳ Initialization taking too long. Check your URL/Token or network.");
    }, 10000);

    try {
      console.log("[TURSO] 🏗️ Ensuring database schema exists...");
      
      const tables = [
        {
          name: "users",
          sql: `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            status TEXT NOT NULL DEFAULT 'active',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )`
        },
        {
          name: "erp_orders",
          sql: `CREATE TABLE IF NOT EXISTS erp_orders (
            id TEXT PRIMARY KEY,
            buyer TEXT,
            erp_date TEXT,
            erp_ship_date TEXT,
            job_ref TEXT,
            style_no TEXT,
            file_no TEXT,
            color TEXT,
            cpl_qty_kg REAL,
            order_qty INTEGER,
            sew_floor TEXT,
            floor TEXT,
            item TEXT,
            wash_type TEXT,
            wash_status TEXT DEFAULT 'Pending' COLLATE BINARY,
            status TEXT DEFAULT 'New',
            plan TEXT,
            print_emb TEXT,
            source_ref TEXT,
            remarks TEXT,
            uploaded_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )`
        },
        {
            name: "daily_logs",
            sql: `CREATE TABLE IF NOT EXISTS daily_logs (
              id TEXT PRIMARY KEY,
              erp_order TEXT,
              log_date TEXT,
              received_qty REAL,
              delivered_qty REAL,
              unit TEXT,
              ready_for_delivery_qty REAL,
              remarks TEXT,
              created_by TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            )`
        },
        {
            name: "buyer_data_bank",
            sql: `CREATE TABLE IF NOT EXISTS buyer_data_bank (
              id TEXT PRIMARY KEY,
              erp_order TEXT,
              buyer TEXT,
              file_no TEXT,
              style_no TEXT,
              color TEXT,
              order_qty INTEGER,
              total_received REAL,
              total_delivered REAL,
              close_date TEXT,
              final_delivered_qty REAL,
              wash_type TEXT,
              closed_by TEXT,
              is_locked INTEGER DEFAULT 1,
              created_at TEXT DEFAULT (datetime('now'))
            )`
        },
        {
            name: "audit_logs",
            sql: `CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              action TEXT,
              userId TEXT,
              ip TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            )`
        }
      ];

      for (const table of tables) {
        try {
          await this.client.execute(table.sql);
          // console.log(`[TURSO] ✅ Table ensured: ${table.name}`);
        } catch (tableErr: any) {
          console.error(`[TURSO] ❌ Failed to ensure table "${table.name}":`, tableErr.message);
          
          const maskedUrl = this.url.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@").replace(/authToken=[^&]+/, "authToken=****");

          // Handle Fetch Failed (Network/DNS issues)
          if (tableErr.message.includes("fetch failed")) {
            throw new Error(`Database Network Error: Failed to reach the database server. 
            
Original error: fetch failed.
Attempted URL: ${maskedUrl}

Possible causes:
1. The host "${maskedUrl.split('//')[1]?.split('.')[0] || 'your-db'}" does not exist.
2. There is a network restriction preventing the app from reaching Turso.
3. Your TURSO_DATABASE_URL is missing the '.turso.io' suffix or organization name.`);
          }

          // If connection is 404, we'll know here
          if (tableErr.message.includes("404")) {
              let host = "unknown";
              try {
                const urlObj = new URL(this.url.replace("libsql://", "http://"));
                host = urlObj.host;
              } catch (e) {}
              throw new Error(`Turso Connection Error (404). Host "${host}" was reached but the database was not found. 
              
Possible reasons:
1. Typo in database or organization name in your TURSO_DATABASE_URL.
2. You used a Dashboard URL instead of a Connection URL.
3. Your TURSO_DATABASE_URL format is wrong.

Current Attempted URL: ${maskedUrl}
Expected Format: libsql://your-db-name-your-org-name.turso.io`);
          }
        }
      }

      // Migrations for newly added columns
      const migrations = [
        "ALTER TABLE erp_orders ADD COLUMN erp_ship_date TEXT",
        "ALTER TABLE erp_orders ADD COLUMN floor TEXT",
        "ALTER TABLE erp_orders ADD COLUMN status TEXT DEFAULT 'New'",
        "ALTER TABLE erp_orders ADD COLUMN plan TEXT",
        "ALTER TABLE erp_orders ADD COLUMN print_emb TEXT",
        "ALTER TABLE erp_orders ADD COLUMN source_ref TEXT",
        "ALTER TABLE erp_orders ADD COLUMN remarks TEXT",
        "ALTER TABLE erp_orders ADD COLUMN uploaded_by TEXT"
      ];

      for (const stmt of migrations) {
        try {
          await this.client.execute(stmt);
        } catch (e: any) {
             // Ignore "duplicate column name" errors
             if (!e.message.includes("duplicate column name")) {
                // log unexpected errors but don't crash
                // console.error("Migration skipped/error:", e.message); 
             }
        }
      }

      console.log("[TURSO] ✅ Database schema verified.");
    } catch (err: any) {
      this.hasError = true;
      console.error("[TURSO] 🚨 Critical Initialization error:", err.message);
      console.warn("[TURSO] 💡 Falling back to MemoryAdapter for seamless operation.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async ensureTable(col: string) {
    await this.initPromise;
    if (this.CORE_TABLES.includes(col) || this.ensuredTables.has(col)) return;
    try {
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS ${col} (
          id TEXT PRIMARY KEY,
          data TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      this.ensuredTables.add(col);
    } catch (err: any) {
      console.error(`[TURSO] Error ensuring table ${col}:`, err.message);
    }
  }

  async getDoc(collection: string, id: string): Promise<any> {
    if (this.hasError) return this.fallbackMemory.getDoc(collection, id);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.getDoc(collection, id);

      if (collection === "users") {
        const result = await this.client.execute({
          sql: "SELECT * FROM users WHERE id = ? OR username = ?",
          args: [id, id],
        });
        return result.rows[0] ? this.rowToObject(result.rows[0]) : null;
      }

      await this.ensureTable(collection);

      const result = await this.client.execute({
        sql: `SELECT * FROM ${collection} WHERE id = ?`,
        args: [id],
      });

      if (!result.rows[0]) return null;

      if (this.CORE_TABLES.includes(collection)) {
        return this.rowToObject(result.rows[0]);
      }

      const row: any = result.rows[0];
      let dataObj = {};
      try {
        if (row.data) dataObj = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      } catch (e) {}
      return { id: row.id, ...dataObj };
    } catch (err) {
      console.warn(`[TURSO] Error in getDoc for ${collection}, using Memory fallback:`, (err as any)?.message);
      return this.fallbackMemory.getDoc(collection, id);
    }
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    if (this.hasError) return this.fallbackMemory.setDoc(collection, id, data);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.setDoc(collection, id, data);

      if (!data.id) data.id = id;
      await this.ensureTable(collection);

      if (this.CORE_TABLES.includes(collection)) {
        const keys = Object.keys(data);
        if (collection === "users") {
          const existing = await this.getDoc("users", id);
          if (existing) {
            const updates = keys.filter(k => k !== 'id').map(k => `${k} = ?`).join(", ");
            const args = keys.filter(k => k !== 'id').map(k => data[k]);
            args.push(id);
            await this.client.execute({
              sql: `UPDATE users SET ${updates}, updated_at = (datetime('now')) WHERE id = ?`,
              args,
            });
          } else {
            const columns = Object.keys(data).join(", ");
            const placeholders = Object.keys(data).map(() => "?").join(", ");
            await this.client.execute({
              sql: `INSERT INTO users (${columns}) VALUES (${placeholders})`,
              args: Object.values(data),
            });
          }
          return;
        }

        const updates = keys.filter(k => k !== 'id').map(k => `${k} = ?`).join(", ");
        const args = keys.filter(k => k !== 'id').map(k => data[k]);
        args.push(id);
        
        const result = await this.client.execute({
            sql: `UPDATE ${collection} SET ${updates} WHERE id = ?`,
            args,
        });

        if (result.rowsAffected === 0) {
            const columns = Object.keys(data).join(", ");
            const placeholders = Object.keys(data).map(() => "?").join(", ");
            await this.client.execute({
                sql: `INSERT INTO ${collection} (${columns}) VALUES (${placeholders})`,
                args: Object.values(data),
            });
        }
      } else {
        const jsonStr = JSON.stringify(data);
        const result = await this.client.execute({
          sql: `UPDATE ${collection} SET data = ?, updated_at = (datetime('now')) WHERE id = ?`,
          args: [jsonStr, id]
        });

        if (result.rowsAffected === 0) {
          await this.client.execute({
            sql: `INSERT INTO ${collection} (id, data) VALUES (?, ?)`,
            args: [id, jsonStr]
          });
        }
      }
    } catch (err: any) {
      console.warn(`[TURSO] Error in setDoc for ${collection}, using Memory fallback:`, err.message);
      return this.fallbackMemory.setDoc(collection, id, data);
    }
  }

  async addDoc(collection: string, data: any): Promise<string> {
    const id = data.id || randomUUID();
    await this.setDoc(collection, id, { ...data, id });
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    if (this.hasError) return this.fallbackMemory.updateDoc(collection, id, data);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.updateDoc(collection, id, data);

      await this.ensureTable(collection);

      if (this.CORE_TABLES.includes(collection)) {
        const keys = Object.keys(data);
        const updates = keys.map(k => `${k} = ?`).join(", ");
        const args = keys.map(k => data[k]);
        args.push(id);

        await this.client.execute({
          sql: `UPDATE ${collection} SET ${updates}, updated_at = (datetime('now')) WHERE id = ?`,
          args,
        });
      } else {
        const existing = await this.getDoc(collection, id) || {};
        const merged = { ...existing, ...data, id };
        await this.setDoc(collection, id, merged);
      }
    } catch (err: any) {
      console.warn(`[TURSO] Error in updateDoc for ${collection}, using Memory fallback:`, err.message);
      return this.fallbackMemory.updateDoc(collection, id, data);
    }
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    if (this.hasError) return this.fallbackMemory.deleteDoc(collection, id);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.deleteDoc(collection, id);

      await this.ensureTable(collection);

      await this.client.execute({
        sql: `DELETE FROM ${collection} WHERE id = ?`,
        args: [id],
      });
    } catch (err: any) {
      console.warn(`[TURSO] Error in deleteDoc for ${collection}, using Memory fallback:`, err.message);
      return this.fallbackMemory.deleteDoc(collection, id);
    }
  }

  async getDocs(collection: string, filters?: any[]): Promise<any[]> {
    if (this.hasError) return this.fallbackMemory.getDocs(collection);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.getDocs(collection);

      await this.ensureTable(collection);

      const result = await this.client.execute(`SELECT * FROM ${collection} ORDER BY created_at DESC`);
      if (this.CORE_TABLES.includes(collection)) {
        return result.rows.map(row => this.rowToObject(row));
      }

      return result.rows.map((row: any) => {
        let dataObj = {};
        try {
          if (row.data) dataObj = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        } catch (e) {}
        return { id: row.id, ...dataObj };
      });
    } catch (err: any) {
      console.warn(`[TURSO] Error in getDocs for ${collection}, using Memory fallback:`, err.message);
      return this.fallbackMemory.getDocs(collection);
    }
  }

  private rowToObject(row: any): any {
    return { ...row };
  }
}
