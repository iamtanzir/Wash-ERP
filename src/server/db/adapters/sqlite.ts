import * as libsql from "@libsql/client";
import type { Client } from "@libsql/client";
const { createClient } = (libsql as any).default || libsql;
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseAdapter } from "../index.js";
import { MemoryAdapter } from "./memory.js";

export class SQLiteAdapter implements DatabaseAdapter {
  private client: Client;
  private initPromise: Promise<void>;
  private filePath: string;
  private fallbackMemory = new MemoryAdapter();
  private hasError = false;
  private CORE_TABLES = ["users", "erp_orders", "daily_logs", "buyer_data_bank", "audit_logs", "system_backups"];
  private ensuredTables = new Set<string>();

  constructor() {
    // Determine the database file path
    // Supports custom path (e.g. Google Drive sync folder or custom directory on RPi / PC)
    let dbFile = process.env.SQLITE_PATH || process.env.LOCAL_DB_PATH || process.env.GDRIVE_DB_PATH;
    
    if (!dbFile) {
      const filename = process.env.SQLITE_FILENAME || "erp_database.sqlite";
      const dataDir = path.resolve(process.cwd(), "data");
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      } catch (err: any) {
        console.warn("[SQLITE] Could not create data directory:", err.message);
      }
      dbFile = path.join(dataDir, filename);
    } else {
      // Ensure directory for custom path exists
      try {
        const customDir = path.dirname(path.resolve(dbFile.replace(/^file:/, "")));
        if (!fs.existsSync(customDir)) {
          fs.mkdirSync(customDir, { recursive: true });
        }
      } catch (err: any) {
        console.warn("[SQLITE] Could not create custom database directory:", err.message);
      }
    }

    this.filePath = dbFile;
    const clientUrl = dbFile.startsWith("file:") ? dbFile : `file:${path.resolve(dbFile)}`;
    console.log(`[SQLITE] 💽 Initializing Local/RPi/Google Drive SQLite file: ${clientUrl}`);

    try {
      this.client = createClient({
        url: clientUrl
      });
    } catch (err: any) {
      console.error("[SQLITE] 🚨 Failed to create client:", err.message);
      this.hasError = true;
      this.client = {
        execute: () => { throw new Error("SQLite client failed to initialize"); },
        batch: () => { throw new Error("SQLite client failed to initialize"); },
        close: () => {},
        sync: () => { throw new Error("SQLite client failed to initialize"); }
      } as any;
    }

    this.initPromise = this.init();
  }

  public getDbFilePath(): string {
    return this.filePath;
  }

  private async init() {
    if (this.hasError) return;
    try {
      console.log("[SQLITE] 🏗️ Initializing ERP tables on local storage...");

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
        },
        {
          name: "system_backups",
          sql: `CREATE TABLE IF NOT EXISTS system_backups (
            id TEXT PRIMARY KEY,
            filename TEXT,
            size_bytes INTEGER,
            record_counts TEXT,
            storage_target TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )`
        }
      ];

      for (const table of tables) {
        await this.client.execute(table.sql);
        this.ensuredTables.add(table.name);
      }

      console.log("[SQLITE] ✅ Local storage ready. All ERP tables initialized.");
    } catch (err: any) {
      console.error("[SQLITE] ⚠️ Init warning:", err.message);
      this.hasError = true;
    }
  }

  private async ensureTable(col: string) {
    if (this.hasError || this.ensuredTables.has(col)) return;
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
      console.error(`[SQLITE] Error ensuring table ${col}:`, err.message);
    }
  }

  private rowToObject(row: any): any {
    if (!row) return null;
    const obj: any = {};
    for (const key of Object.keys(row)) {
      obj[key] = row[key];
    }
    return obj;
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
    } catch (err: any) {
      console.error(`[SQLITE] Error in getDoc for ${collection}:`, err.message);
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
            const updates = keys.filter(k => k !== "id").map(k => `${k} = ?`).join(", ");
            const args = keys.filter(k => k !== "id").map(k => data[k]);
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

        const updates = keys.filter(k => k !== "id").map(k => `${k} = ?`).join(", ");
        const args = keys.filter(k => k !== "id").map(k => data[k]);
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
      console.error(`[SQLITE] Error in setDoc for ${collection}:`, err.message);
      return this.fallbackMemory.setDoc(collection, id, data);
    }
  }

  async addDoc(collection: string, data: any): Promise<string> {
    const id = randomUUID();
    await this.setDoc(collection, id, data);
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    if (this.hasError) return this.fallbackMemory.updateDoc(collection, id, data);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.updateDoc(collection, id, data);

      const existing = await this.getDoc(collection, id);
      if (!existing) throw new Error("Document not found");

      await this.setDoc(collection, id, { ...existing, ...data });
    } catch (err: any) {
      console.error(`[SQLITE] Error in updateDoc for ${collection}:`, err.message);
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
      console.error(`[SQLITE] Error in deleteDoc for ${collection}:`, err.message);
      return this.fallbackMemory.deleteDoc(collection, id);
    }
  }

  async getDocs(collection: string, filters?: any[]): Promise<any[]> {
    if (this.hasError) return this.fallbackMemory.getDocs(collection);
    try {
      await this.initPromise;
      if (this.hasError) return this.fallbackMemory.getDocs(collection);

      await this.ensureTable(collection);

      let sql = `SELECT * FROM ${collection}`;
      if (collection === "erp_orders" || collection === "daily_logs" || collection === "buyer_data_bank") {
        sql += " ORDER BY created_at DESC";
      }

      const result = await this.client.execute(sql);
      const rows = result.rows || [];

      if (this.CORE_TABLES.includes(collection)) {
        return rows.map((r: any) => this.rowToObject(r));
      }

      return rows.map((row: any) => {
        let dataObj = {};
        try {
          if (row.data) dataObj = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        } catch (e) {}
        return { id: row.id, ...dataObj };
      });
    } catch (err: any) {
      console.error(`[SQLITE] Error in getDocs for ${collection}:`, err.message);
      return this.fallbackMemory.getDocs(collection);
    }
  }
}
