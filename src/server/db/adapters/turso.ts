import * as libsql from "@libsql/client";
import type { Client } from "@libsql/client";
const { createClient } = (libsql as any).default || libsql;
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.ts";

export class TursoAdapter implements DatabaseAdapter {
  private client: Client;
  private initPromise: Promise<void>;
  private url: string;

  constructor() {
    let url = process.env.TURSO_DATABASE_URL || "";
    let authToken = process.env.TURSO_AUTH_TOKEN || "";

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

    const maskedUrl = url.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@").replace(/authToken=[^&]+/, "authToken=****");
    console.log(`[TURSO] 🔌 Connecting to: ${maskedUrl}`);
    this.url = url;

    this.client = createClient({
      url,
      authToken,
    });

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
            job_ref TEXT,
            style_no TEXT,
            file_no TEXT,
            color TEXT,
            cpl_qty_kg REAL,
            order_qty INTEGER,
            sew_floor TEXT,
            item TEXT,
            wash_type TEXT,
            wash_status TEXT DEFAULT 'Pending' COLLATE BINARY,
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
              id INTEGER PRIMARY KEY AUTOINCREMENT,
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

      console.log("[TURSO] ✅ Database schema verified.");
    } catch (err: any) {
      console.error("[TURSO] 🚨 Critical Initialization error:", err.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getDoc(collection: string, id: string): Promise<any> {
    await this.initPromise;
    if (collection === "users") {
      const result = await this.client.execute({
        sql: "SELECT * FROM users WHERE id = ? OR username = ?",
        args: [id, id],
      });
      return result.rows[0] ? this.rowToObject(result.rows[0]) : null;
    }

    // For other collections, we simulate a document-like storage if it doesn't have a specific table
    // or we use the erp_orders if it matches.
    if (collection === "erp_orders") {
        const result = await this.client.execute({
            sql: "SELECT * FROM erp_orders WHERE id = ?",
            args: [id],
        });
        return result.rows[0] ? this.rowToObject(result.rows[0]) : null;
    }

    // Default fallback: Try to query by ID if table exists
    try {
        const result = await this.client.execute({
            sql: `SELECT * FROM ${collection} WHERE id = ?`,
            args: [id],
        });
        return result.rows[0] ? this.rowToObject(result.rows[0]) : null;
    } catch {
        return null;
    }
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    // Ensure ID is in data if it's not already there for the query
    if (!data.id) data.id = id;

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

    // Generic UPSERT for other tables (assuming they have the right columns)
    try {
        const updates = keys.filter(k => k !== 'id').map(k => `${k} = ?`).join(", ");
        const args = keys.filter(k => k !== 'id').map(k => data[k]);
        args.push(id);
        
        // Try update first
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
    } catch (err: any) {
        console.error(`[TURSO] Error in setDoc for ${collection}:`, err.message);
    }
  }

  async addDoc(collection: string, data: any): Promise<string> {
    const id = randomUUID();
    await this.setDoc(collection, id, { ...data, id });
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const keys = Object.keys(data);
    const updates = keys.map(k => `${k} = ?`).join(", ");
    const args = keys.map(k => data[k]);
    args.push(id);

    await this.client.execute({
      sql: `UPDATE ${collection} SET ${updates}, updated_at = (datetime('now')) WHERE id = ?`,
      args,
    });
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    await this.initPromise;
    await this.client.execute({
      sql: `DELETE FROM ${collection} WHERE id = ?`,
      args: [id],
    });
  }

  async getDocs(collection: string, filters?: any[]): Promise<any[]> {
    await this.initPromise;
    try {
        const result = await this.client.execute(`SELECT * FROM ${collection} ORDER BY created_at DESC`);
        return result.rows.map(row => this.rowToObject(row));
    } catch (err: any) {
        console.error(`[TURSO] Error in getDocs for ${collection}:`, err.message);
        return [];
    }
  }

  private rowToObject(row: any): any {
    // Convert row array to object based on column names if available
    // For @libsql/client, row is an object-like with columns as properties
    return { ...row };
  }
}
