import { PocketBaseAdapter } from "./adapters/pocketbase.js";
import { SupabaseAdapter } from "./adapters/supabase.js";
import { FirebaseAdapter } from "./adapters/firebase.js";
import { SQLiteAdapter } from "./adapters/sqlite.js";
import { TursoAdapter } from "./adapters/turso.js";
import { CockroachDBAdapter } from "./adapters/cockroach.js";
import { XataAdapter } from "./adapters/xata.js";
import { MemoryAdapter } from "./adapters/memory.js";
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
  
  // 1. Auto-detection: If no mode is set, check for environment variables
  if (!envDbType) {
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN && process.env.TURSO_DATABASE_URL !== "libsql://missing-url.turso.io") {
      console.log("[DB] ⚡ Auto-detected Turso configuration");
      return new TursoAdapter();
    }
    
    if (process.env.FIREBASE_PROJECT_ID || fs.existsSync("./firebase-applet-config.json")) {
       console.log("[DB] ⚡ Auto-detected Firebase configuration");
       return new FirebaseAdapter();
    }
    
    if (process.env.POCKETBASE_URL) {
      console.log("[DB] ⚡ Auto-detected PocketBase configuration");
      return new PocketBaseAdapter();
    }

    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log("[DB] ⚡ Auto-detected Supabase configuration");
      return new SupabaseAdapter();
    }
    
    if (process.env.VERCEL) {
      console.log("[DB] Vercel environment detected, defaulting to TursoAdapter for persistent database connection");
      return new TursoAdapter();
    }

    console.log("[DB] No database environment variables found, defaulting to SQLite or Memory");
    try {
      return new SQLiteAdapter();
    } catch {
      return new MemoryAdapter();
    }
  }

  const dbType = envDbType.toLowerCase();
  console.log(`[DB] Using Explicit Database Mode: "${dbType}"`);

  switch (dbType) {
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
      try {
        return new SQLiteAdapter();
      } catch {
        return new MemoryAdapter();
      }
    case "memory":
      return new MemoryAdapter();
    default:
      console.warn(`[DB] Unsupported database mode "${dbType}", falling back to MemoryAdapter`);
      return new MemoryAdapter();
  }
}
