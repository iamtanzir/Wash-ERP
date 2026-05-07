import * as libsql from "@libsql/client";
import type { Client } from "@libsql/client";
const { createClient } = (libsql as any).default || libsql;
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.ts";

export class TursoAdapter implements DatabaseAdapter {
  private client: Client;
  private initPromise: Promise<void>;

  constructor() {
    let url = process.env.TURSO_DATABASE_URL || "";
    let authToken = process.env.TURSO_AUTH_TOKEN || "";

    // Sanitize URLs that might be wrapped in quotes
    url = url.replace(/^['"](.*)['"]$/, '$1');
    authToken = authToken.replace(/^['"](.*)['"]$/, '$1');

    if (!url || !authToken) {
      console.warn("[TURSO] Missing environment variables. Connection may fail.");
    }

    this.client = createClient({
      url,
      authToken,
    });

    this.initPromise = this.init();
  }

  private async init() {
    const timeout = setTimeout(() => {
      console.warn("[TURSO] Initialization taking too long. Check your URL/Token or network.");
    }, 5000);

    try {
      // Create users table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          status TEXT NOT NULL DEFAULT 'active',
          created_by TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);

      // Create erp_orders table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS erp_orders (
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
        )
      `);

      // Create daily_logs table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS daily_logs (
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
        )
      `);

      // Create buyer_data_bank table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS buyer_data_bank (
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
        )
      `);

      // Create audit_logs table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT,
          userId TEXT,
          ip TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);

      console.log("[TURSO] Database schema ensured.");
    } catch (err: any) {
      console.error("[TURSO] Initialization error:", err.message);
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
