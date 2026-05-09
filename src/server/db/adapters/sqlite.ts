import * as knexPkg from "knex";
const knex = (knexPkg as any).default || knexPkg;
import type { Knex } from "knex";
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.js";
import path from "path";

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Knex;
  private initPromise: Promise<void>;
  private CORE_TABLES = ['users', 'erp_orders', 'daily_logs', 'buyer_data_bank', 'audit_logs'];

  constructor() {
    const filename = process.env.SQLITE_FILENAME || "wash_erp.sqlite";
    const dbPath = path.resolve(process.cwd(), filename);
    
    this.db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: dbPath
      },
      useNullAsDefault: true
    });

    this.initPromise = this.init();
  }

  private async init() {
    try {
        await this.db.raw(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            status TEXT NOT NULL DEFAULT 'active',
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await this.db.raw(`
          CREATE TABLE IF NOT EXISTS erp_orders (
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
            wash_status TEXT DEFAULT 'Pending',
            status TEXT DEFAULT 'New',
            plan TEXT,
            print_emb TEXT,
            source_ref TEXT,
            remarks TEXT,
            uploaded_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Migration logic for existing tables if they were created with the old schema
        const erpOrderColumns = [
            { name: 'erp_ship_date', type: 'TEXT' },
            { name: 'floor', type: 'TEXT' },
            { name: 'status', type: 'TEXT DEFAULT "New"' },
            { name: 'plan', type: 'TEXT' },
            { name: 'print_emb', type: 'TEXT' },
            { name: 'source_ref', type: 'TEXT' },
            { name: 'remarks', type: 'TEXT' },
            { name: 'uploaded_by', type: 'TEXT' }
        ];

        for (const col of erpOrderColumns) {
            try {
                await this.db.raw(`ALTER TABLE erp_orders ADD COLUMN ${col.name} ${col.type}`);
            } catch (e: any) {
                // Ignore "duplicate column name" errors
            }
        }

        await this.db.raw(`
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await this.db.raw(`
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await this.db.raw(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            userId TEXT,
            ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`[SQLITE] All ERP tables ensured.`);
    } catch (err: any) {
        console.error(`[SQLITE] Initialization Error:`, err.message);
    }
  }

  private async ensureTable(col: string) {
      await this.initPromise;
      if (this.CORE_TABLES.includes(col)) return;
      try {
          const tableExists = await this.db.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [col]);
          if (tableExists.response?.length === 0 || (Array.isArray(tableExists) && tableExists.length === 0)) {
              await this.db.raw(`
                CREATE TABLE IF NOT EXISTS ${col} (
                  id TEXT PRIMARY KEY,
                  data TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `);
          }
      } catch (err) {
          console.error(`Error ensuring table ${col}:`, err);
      }
  }

  async getDoc(col: string, id: string) {
    await this.initPromise;
    if (col === 'users') {
        const user = await this.db(col).where({ id }).orWhere({ username: id }).first();
        return user || null;
    }
    await this.ensureTable(col);
    const row = await this.db(col).where({ id }).first();
    if (!row) return null;
    
    if (this.CORE_TABLES.includes(col)) return row;
    return { id: row.id, ...JSON.parse(row.data) };
  }

  async setDoc(col: string, id: string, data: any) {
    await this.initPromise;
    await this.ensureTable(col);
    const existing = await this.db(col).where({ id }).first();
    
    if (this.CORE_TABLES.includes(col)) {
        if (existing) {
            await this.db(col).where({ id }).update({ ...data, updated_at: this.db.fn.now() });
        } else {
            await this.db(col).insert({ ...data, id });
        }
    } else {
        const jsonStr = JSON.stringify(data);
        if (existing) {
            await this.db(col).where({ id }).update({ data: jsonStr, updated_at: this.db.fn.now() });
        } else {
            await this.db(col).insert({ id, data: jsonStr, created_at: this.db.fn.now(), updated_at: this.db.fn.now() });
        }
    }
  }

  async addDoc(col: string, data: any) {
    const id = randomUUID();
    await this.setDoc(col, id, data);
    return id;
  }

  async updateDoc(col: string, id: string, data: any) {
      await this.initPromise;
      await this.ensureTable(col);
      const existing = await this.getDoc(col, id);
      if (!existing) throw new Error("Not found");
      await this.setDoc(col, id, { ...existing, ...data });
  }

  async deleteDoc(col: string, id: string) {
      await this.initPromise;
      await this.ensureTable(col);
      await this.db(col).where({ id }).delete();
  }

  async getDocs(col: string) {
    await this.ensureTable(col);
    const rows = await this.db(col).select("*").orderBy('created_at', 'desc');
    if (this.CORE_TABLES.includes(col)) return rows;
    return rows.map(r => ({ id: r.id, ...JSON.parse(r.data) }));
  }
}
