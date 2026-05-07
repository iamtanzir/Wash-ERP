import { PocketBaseAdapter } from "./adapters/pocketbase.ts";
import { SupabaseAdapter } from "./adapters/supabase.ts";
import { FirebaseAdapter } from "./adapters/firebase.ts";
import { SQLiteAdapter } from "./adapters/sqlite.ts";
import { TursoAdapter } from "./adapters/turso.ts";
import { CockroachDBAdapter } from "./adapters/cockroach.ts";
import { XataAdapter } from "./adapters/xata.ts";
import fs from "node:fs";

export interface DatabaseAdapter {
  getDoc(collection: string, id: string): Promise<any>;
  setDoc(collection: string, id: string, data: any): Promise<void>;
  addDoc(collection: string, data: any): Promise<string>;
  updateDoc(collection: string, id: string, data: any): Promise<void>;
  deleteDoc(collection: string, id: string): Promise<void>;
  getDocs(collection: string, filters?: any[]): Promise<any[]>;
}

export function getDatabase(): DatabaseAdapter {
  const envDbType = process.env.DATABASE_MODE || process.env.DB_TYPE;
  const dbType = envDbType || "sqlite";
  
  console.log(`[DB] Using Database Mode: "${dbType}"`);

  switch (dbType.toLowerCase()) {
    case "turso":
      if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
          return new TursoAdapter();
      }
      console.warn("[DB] Turso requested but keys missing, falling back to SQLite");
      return new SQLiteAdapter();
    case "cockroach":
    case "cockroachdb":
      return new CockroachDBAdapter();
    case "xata":
      return new XataAdapter();
    case "pocketbase":
      return new PocketBaseAdapter();
    case "supabase":
      if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
          return new SupabaseAdapter();
      }
      console.warn("[DB] Supabase requested but keys missing, falling back to SQLite");
      return new SQLiteAdapter();
    case "firebase":
      try {
        if (fs.existsSync("./firebase-applet-config.json")) {
            return new FirebaseAdapter();
        }
      } catch (err) {
        console.warn("[DB] Firebase requested but config check failed, falling back to SQLite");
      }
      return new SQLiteAdapter();
    case "sqlite":
      return new SQLiteAdapter();
    default:
      try {
        if (fs.existsSync("./firebase-applet-config.json")) {
            console.log("[DB] Defaulting to Firebase adapter (config found)");
            return new FirebaseAdapter();
        }
      } catch (err) {
          // ignore
      }
      console.log(`[DB] No matching provider for "${dbType}" and no Firebase config, defaulting to SQLite adapter`);
      return new SQLiteAdapter();
  }
}
