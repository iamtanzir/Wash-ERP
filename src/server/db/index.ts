import { PocketBaseAdapter } from "./adapters/pocketbase.ts";
import { SupabaseAdapter } from "./adapters/supabase.ts";
import { FirebaseAdapter } from "./adapters/firebase.ts";
import { SQLiteAdapter } from "./adapters/sqlite.ts";

export interface DatabaseAdapter {
  getDoc(collection: string, id: string): Promise<any>;
  setDoc(collection: string, id: string, data: any): Promise<void>;
  addDoc(collection: string, data: any): Promise<string>;
  updateDoc(collection: string, id: string, data: any): Promise<void>;
  deleteDoc(collection: string, id: string): Promise<void>;
  getDocs(collection: string, filters?: any[]): Promise<any[]>;
}

export function getDatabase(): DatabaseAdapter {
  const envDbType = process.env.DB_TYPE;
  // If we are in the AI Studio environment and no specific DB is requested,
  // or if we want to ensure we do not use Firebase, default to sqlite.
  const dbType = envDbType || "sqlite";
  
  console.log(`[DB] process.env.DB_TYPE: "${envDbType}", Decided on: "${dbType}"`);

  switch (dbType.toLowerCase()) {
    case "pocketbase":
      return new PocketBaseAdapter();
    case "supabase":
      // Only use Supabase if keys are likely present
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
          return new SupabaseAdapter();
      }
      console.warn("[DB] Supabase requested but keys missing, falling back to SQLite");
      return new SQLiteAdapter();
    case "sqlite":
      return new SQLiteAdapter();
    case "firebase":
    default:
      // Prevent accidental Firebase usage as requested by user
      console.log("[DB] Defaulting to SQLite adapter");
      return new SQLiteAdapter();
  }
}
