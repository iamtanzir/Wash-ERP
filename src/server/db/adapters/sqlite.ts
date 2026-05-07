import knex, { Knex } from "knex";
import type { DatabaseAdapter } from "../index.ts";
import path from "path";
import fs from "fs";

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Knex;

  private initPromise: Promise<void>;

  constructor() {
    const filename = process.env.SQLITE_FILENAME || "erp_database.sqlite";
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
        console.log(`[SQLITE] Initializing database to: ${path.resolve(process.cwd(), process.env.SQLITE_FILENAME || "erp_database.sqlite")}`);
        
        await this.db.raw(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password_hash TEXT,
            role TEXT,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`[SQLITE] Users table ensured.`);

        await this.db.raw(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            userId TEXT,
            ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
    } catch (err: any) {
        console.error(`[SQLITE] ❌ Initialization Error:`, err.message);
    }
  }

  private async ensureTable(col: string) {
      await this.initPromise;
      try {
          const tableExists = await this.db.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [col]);
          if (tableExists.length === 0) {
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
        return user;
    }
    await this.ensureTable(col);
    const row = await this.db(col).where({ id }).first();
    return row ? { id: row.id, ...JSON.parse(row.data) } : null;
  }

  async setDoc(col: string, id: string, data: any) {
    await this.initPromise;
    if (col === 'users') {
        const existing = await this.db(col).where({ id }).first();
        if (existing) {
            const { id: _, ...updateData } = data;
            await this.db(col).where({ id }).update({ ...updateData, updated_at: this.db.fn.now() });
        } else {
            await this.db(col).insert({ ...data, id, created_at: this.db.fn.now(), updated_at: this.db.fn.now() });
        }
        return;
    }
    await this.ensureTable(col);
    const existing = await this.db(col).where({ id }).first();
    const jsonStr = JSON.stringify(data);
    if (existing) {
        await this.db(col).where({ id }).update({ data: jsonStr, updated_at: this.db.fn.now() });
    } else {
        await this.db(col).insert({ id, data: jsonStr, created_at: this.db.fn.now(), updated_at: this.db.fn.now() });
    }
  }

  async addDoc(col: string, data: any) {
    const id = Math.random().toString(36).substring(2, 12);
    await this.setDoc(col, id, data);
    return id;
  }

  async updateDoc(col: string, id: string, data: any) {
      const existing = await this.getDoc(col, id);
      if (!existing) throw new Error("Not found");
      await this.setDoc(col, id, { ...existing, ...data });
  }

  async deleteDoc(col: string, id: string) {
      await this.ensureTable(col);
      await this.db(col).where({ id }).delete();
  }

  async getDocs(col: string) {
    await this.ensureTable(col);
    const rows = await this.db(col).select("*").orderBy('created_at', 'desc');
    if (col === 'users') return rows;
    return rows.map(r => ({ id: r.id, ...JSON.parse(r.data) }));
  }
}
