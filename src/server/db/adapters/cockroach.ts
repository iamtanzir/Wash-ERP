import * as pg from 'pg';
const Client = (pg as any).default?.Client || pg.Client;
import type { Client as ClientType } from 'pg';
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.ts";

export class CockroachDBAdapter implements DatabaseAdapter {
  private client: ClientType;
  private initPromise: Promise<void>;

  constructor() {
    let connectionString = process.env.COCKROACH_DATABASE_URL || "";
    
    // Sanitize quotes
    connectionString = connectionString.replace(/^['"](.*)['"]$/, '$1');

    if (!connectionString) {
      console.warn("[COCKROACH] Missing COCKROACH_DATABASE_URL environment variable.");
    }

    this.client = new Client({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    }) as ClientType;

    this.initPromise = this.init();
  }

  private async init() {
    try {
      await this.client.connect();
      
      // Enforce isolation: Each table setup is specific to the postgres/cockroach syntax
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `);

      await this.client.query(`
        CREATE TABLE IF NOT EXISTS erp_orders (
          id TEXT PRIMARY KEY,
          buyer TEXT,
          erp_date TEXT,
          job_ref TEXT,
          style_no TEXT,
          file_no TEXT,
          color TEXT,
          cpl_qty_kg FLOAT8,
          order_qty INTEGER,
          sew_floor TEXT,
          item TEXT,
          wash_type TEXT,
          wash_status TEXT DEFAULT 'Pending',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `);

      await this.client.query(`
        CREATE TABLE IF NOT EXISTS daily_logs (
          id TEXT PRIMARY KEY,
          erp_order TEXT,
          log_date TEXT,
          received_qty FLOAT8,
          delivered_qty FLOAT8,
          unit TEXT,
          ready_for_delivery_qty FLOAT8,
          remarks TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);

      await this.client.query(`
        CREATE TABLE IF NOT EXISTS buyer_data_bank (
          id TEXT PRIMARY KEY,
          erp_order TEXT,
          buyer TEXT,
          file_no TEXT,
          style_no TEXT,
          color TEXT,
          order_qty INTEGER,
          total_received FLOAT8,
          total_delivered FLOAT8,
          close_date TEXT,
          final_delivered_qty FLOAT8,
          wash_type TEXT,
          closed_by TEXT,
          is_locked INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);

      console.log("[COCKROACH] Database schema isolated and ensured.");
    } catch (err: any) {
      console.error("[COCKROACH] Initialization error:", err.message);
    }
  }

  async getDoc(collection: string, id: string): Promise<any> {
    await this.initPromise;
    const res = await this.client.query(`SELECT * FROM ${collection} WHERE id = $1 OR (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $2 AND column_name = 'username') THEN username = $1 ELSE FALSE END)`, [id, collection]);
    return res.rows[0] || null;
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const keys = Object.keys(data);
    if (!data.id) data.id = id;
    if (!keys.includes('id')) keys.push('id');

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const updateSet = keys.filter(k => k !== 'id').map((k, i) => {
        // Find correct index in original values
        const valIndex = keys.indexOf(k) + 1;
        return `${k} = $${valIndex}`;
    }).join(", ");
    
    const query = `
      INSERT INTO ${collection} (${keys.join(", ")}) 
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updateSet}, updated_at = now();
    `;
    
    await this.client.query(query, keys.map(k => data[k]));
  }

  async addDoc(collection: string, data: any): Promise<string> {
    const id = randomUUID();
    await this.setDoc(collection, id, { ...data, id });
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const keys = Object.keys(data);
    const updateSet = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    await this.client.query(`UPDATE ${collection} SET ${updateSet}, updated_at = now() WHERE id = $${keys.length + 1}`, [...Object.values(data), id]);
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    await this.initPromise;
    await this.client.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
  }

  async getDocs(collection: string): Promise<any[]> {
    await this.initPromise;
    const res = await this.client.query(`SELECT * FROM ${collection} ORDER BY created_at DESC`);
    return res.rows;
  }
}
