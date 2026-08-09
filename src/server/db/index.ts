import fs from "node:fs";
import { PolarDBAdapter } from "./adapters/polardb.js";
import { TursoAdapter } from "./adapters/turso.js";
import { CockroachDBAdapter } from "./adapters/cockroach.js";
import { XataAdapter } from "./adapters/xata.js";
import { PocketBaseAdapter } from "./adapters/pocketbase.js";
import { SupabaseAdapter } from "./adapters/supabase.js";
import { FirebaseAdapter } from "./adapters/firebase.js";
import { SQLiteAdapter } from "./adapters/sqlite.js";
import { MemoryAdapter } from "./adapters/memory.js";

export interface DatabaseAdapter {
  getDoc(collection: string, id: string): Promise<any>;
  setDoc(collection: string, id: string, data: any): Promise<void>;
  addDoc(collection: string, data: any): Promise<string>;
  updateDoc(collection: string, id: string, data: any): Promise<void>;
  deleteDoc(collection: string, id: string): Promise<void>;
  getDocs(collection: string, filters?: any[]): Promise<any[]>;
}

class StaticDatabaseAdapter implements DatabaseAdapter {
  private adapter: DatabaseAdapter;

  constructor() {
    this.adapter = this.loadAdapter();
  }

  private loadAdapter(): DatabaseAdapter {
    const envDbType = process.env.DATABASE_MODE || process.env.DB_TYPE;
    let dbType = "";

    if (!envDbType) {
      if (process.env.POLARDB_DATABASE_URL) {
        dbType = "polardb";
      } else if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN && process.env.TURSO_DATABASE_URL !== "libsql://missing-url.turso.io") {
        dbType = "turso";
      } else if (process.env.FIREBASE_PROJECT_ID || fs.existsSync("./firebase-applet-config.json")) {
        dbType = "firebase";
      } else if (process.env.POCKETBASE_URL) {
        dbType = "pocketbase";
      } else if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) {
        dbType = "supabase";
      } else if (process.env.VERCEL) {
        if (process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL !== "libsql://missing-url.turso.io") {
          dbType = "turso";
        } else {
          dbType = "memory";
        }
      } else {
        dbType = "sqlite";
      }
    } else {
      dbType = envDbType.toLowerCase();
    }

    console.log(`[DB] Initializing Database Mode: "${dbType}"`);

    try {
      switch (dbType) {
        case "polardb":
        case "postgres":
        case "sequelize":
          return new PolarDBAdapter();
        case "turso":
          return new TursoAdapter();
        case "cockroach":
        case "cockroachdb":
          return new CockroachDBAdapter();
        case "xata":
          return new XataAdapter();
        case "pocketbase":
          return new PocketBaseAdapter();
        case "supabase":
          return new SupabaseAdapter();
        case "firebase":
          return new FirebaseAdapter();
        case "sqlite":
          return new SQLiteAdapter();
        case "memory":
          return new MemoryAdapter();
        default:
          console.warn(`[DB] Unsupported database mode "${dbType}", falling back to MemoryAdapter`);
          return new MemoryAdapter();
      }
    } catch (loadErr: any) {
      console.error(`[DB] ❌ Failed to instantiate adapter for "${dbType}":`, loadErr.message);
      console.log("[DB] 💡 Falling back to MemoryAdapter for seamless execution");
      return new MemoryAdapter();
    }
  }

  async getDoc(collection: string, id: string): Promise<any> {
    try {
      return await this.adapter.getDoc(collection, id);
    } catch (err: any) {
      console.error(`[DB Adapter Error] getDoc failed: ${err.message}`);
      throw err;
    }
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    try {
      await this.adapter.setDoc(collection, id, data);
    } catch (err: any) {
      console.error(`[DB Adapter Error] setDoc failed: ${err.message}`);
      throw err;
    }
  }

  async addDoc(collection: string, data: any): Promise<string> {
    try {
      return await this.adapter.addDoc(collection, data);
    } catch (err: any) {
      console.error(`[DB Adapter Error] addDoc failed: ${err.message}`);
      throw err;
    }
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    try {
      await this.adapter.updateDoc(collection, id, data);
    } catch (err: any) {
      console.error(`[DB Adapter Error] updateDoc failed: ${err.message}`);
      throw err;
    }
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    try {
      await this.adapter.deleteDoc(collection, id);
    } catch (err: any) {
      console.error(`[DB Adapter Error] deleteDoc failed: ${err.message}`);
      throw err;
    }
  }

  async getDocs(collection: string, filters?: any[]): Promise<any[]> {
    try {
      return await this.adapter.getDocs(collection, filters);
    } catch (err: any) {
      console.error(`[DB Adapter Error] getDocs failed: ${err.message}`);
      throw err;
    }
  }
}

export function getDatabase(): DatabaseAdapter {
  return new StaticDatabaseAdapter();
}
