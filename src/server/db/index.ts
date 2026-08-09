import fs from "node:fs";

export interface DatabaseAdapter {
  getDoc(collection: string, id: string): Promise<any>;
  setDoc(collection: string, id: string, data: any): Promise<void>;
  addDoc(collection: string, data: any): Promise<string>;
  updateDoc(collection: string, id: string, data: any): Promise<void>;
  deleteDoc(collection: string, id: string): Promise<void>;
  getDocs(collection: string, filters?: any[]): Promise<any[]>;
}

class LazyDatabaseAdapter implements DatabaseAdapter {
  private adapterPromise: Promise<DatabaseAdapter>;
  private resolvedAdapter: DatabaseAdapter | null = null;

  constructor() {
    this.adapterPromise = this.loadAdapter();
    // Safely catch any adapter loading failure to prevent Unhandled Promise Rejections
    this.adapterPromise.catch((err) => {
      console.error("[DB] 🚨 Critical error lazy-loading database adapter:", err.message);
    });
  }

  private async loadAdapter(): Promise<DatabaseAdapter> {
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
        dbType = "turso";
      } else {
        dbType = "sqlite";
      }
    } else {
      dbType = envDbType.toLowerCase();
    }

    console.log(`[DB] Lazy-initializing Database Mode: "${dbType}"`);

    try {
      switch (dbType) {
        case "polardb":
        case "postgres":
        case "sequelize": {
          const { PolarDBAdapter } = await import("./adapters/polardb.js");
          return new PolarDBAdapter();
        }
        case "turso": {
          const { TursoAdapter } = await import("./adapters/turso.js");
          return new TursoAdapter();
        }
        case "cockroach":
        case "cockroachdb": {
          const { CockroachDBAdapter } = await import("./adapters/cockroach.js");
          return new CockroachDBAdapter();
        }
        case "xata": {
          const { XataAdapter } = await import("./adapters/xata.js");
          return new XataAdapter();
        }
        case "pocketbase": {
          const { PocketBaseAdapter } = await import("./adapters/pocketbase.js");
          return new PocketBaseAdapter();
        }
        case "supabase": {
          const { SupabaseAdapter } = await import("./adapters/supabase.js");
          return new SupabaseAdapter();
        }
        case "firebase": {
          const { FirebaseAdapter } = await import("./adapters/firebase.js");
          return new FirebaseAdapter();
        }
        case "sqlite": {
          const { SQLiteAdapter } = await import("./adapters/sqlite.js");
          return new SQLiteAdapter();
        }
        case "memory": {
          const { MemoryAdapter } = await import("./adapters/memory.js");
          return new MemoryAdapter();
        }
        default: {
          console.warn(`[DB] Unsupported database mode "${dbType}", falling back to MemoryAdapter`);
          const { MemoryAdapter } = await import("./adapters/memory.js");
          return new MemoryAdapter();
        }
      }
    } catch (loadErr: any) {
      console.error(`[DB] ❌ Failed to load adapter for "${dbType}":`, loadErr.message);
      console.log("[DB] 💡 Falling back to MemoryAdapter for seamless execution");
      const { MemoryAdapter } = await import("./adapters/memory.js");
      return new MemoryAdapter();
    }
  }

  private async getAdapter(): Promise<DatabaseAdapter> {
    if (!this.resolvedAdapter) {
      this.resolvedAdapter = await this.adapterPromise;
    }
    return this.resolvedAdapter;
  }

  async getDoc(collection: string, id: string): Promise<any> {
    try {
      const adapter = await this.getAdapter();
      return await adapter.getDoc(collection, id);
    } catch (err: any) {
      console.error(`[DB Adapter Error] getDoc failed: ${err.message}`);
      throw err;
    }
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    try {
      const adapter = await this.getAdapter();
      await adapter.setDoc(collection, id, data);
    } catch (err: any) {
      console.error(`[DB Adapter Error] setDoc failed: ${err.message}`);
      throw err;
    }
  }

  async addDoc(collection: string, data: any): Promise<string> {
    try {
      const adapter = await this.getAdapter();
      return await adapter.addDoc(collection, data);
    } catch (err: any) {
      console.error(`[DB Adapter Error] addDoc failed: ${err.message}`);
      throw err;
    }
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    try {
      const adapter = await this.getAdapter();
      await adapter.updateDoc(collection, id, data);
    } catch (err: any) {
      console.error(`[DB Adapter Error] updateDoc failed: ${err.message}`);
      throw err;
    }
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    try {
      const adapter = await this.getAdapter();
      await adapter.deleteDoc(collection, id);
    } catch (err: any) {
      console.error(`[DB Adapter Error] deleteDoc failed: ${err.message}`);
      throw err;
    }
  }

  async getDocs(collection: string, filters?: any[]): Promise<any[]> {
    try {
      const adapter = await this.getAdapter();
      return await adapter.getDocs(collection, filters);
    } catch (err: any) {
      console.error(`[DB Adapter Error] getDocs failed: ${err.message}`);
      throw err;
    }
  }
}

export function getDatabase(): DatabaseAdapter {
  return new LazyDatabaseAdapter();
}
