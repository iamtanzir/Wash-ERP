import * as supabasePkg from "@supabase/supabase-js";
const { createClient } = (supabasePkg as any).default || supabasePkg;
import type { DatabaseAdapter } from "../index.js";
import { MemoryAdapter } from "./memory.js";

function resolveSupabaseEnv(): { url: string; key: string } {
  let url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  let key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url) {
    const urlKey = Object.keys(process.env).find(
      (k) => k.endsWith("_SUPABASE_URL") && process.env[k]
    );
    if (urlKey) url = process.env[urlKey] || "";
  }

  if (!key) {
    const srKey = Object.keys(process.env).find(
      (k) => k.endsWith("_SUPABASE_SERVICE_ROLE_KEY") && process.env[k]
    );
    const anonKey = Object.keys(process.env).find(
      (k) => k.endsWith("_SUPABASE_ANON_KEY") && process.env[k]
    );
    if (srKey) key = process.env[srKey] || "";
    else if (anonKey) key = process.env[anonKey] || "";
  }

  url = url.trim().replace(/^['"](.*)['"]$/, "$1");
  key = key.trim().replace(/^['"](.*)['"]$/, "$1");
  return { url, key };
}

function isMissingTableOrSchemaError(error: any): boolean {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

export class SupabaseAdapter implements DatabaseAdapter {
  private supabase: any = null;
  private fallbackMemory = new MemoryAdapter();
  private hasError = false;

  constructor() {
    const { url, key } = resolveSupabaseEnv();

    if (!url || !key) {
      console.warn("[SUPABASE] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY; using memory fallback.");
      this.hasError = true;
      return;
    }

    try {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch (err: any) {
      console.error("[SUPABASE] Failed to initialize client:", err?.message || err);
      this.hasError = true;
    }
  }

  async getDoc(col: string, id: string) {
    if (this.hasError || !this.supabase) {
      return this.fallbackMemory.getDoc(col, id);
    }
    try {
      const query =
        col === "users"
          ? this.supabase.from(col).select("*").or(`id.eq.${id},username.eq.${id}`).maybeSingle()
          : this.supabase.from(col).select("*").eq("id", id).maybeSingle();

      const { data, error } = await query;
      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          console.warn(`[SUPABASE] Table "${col}" unavailable (${error.message}); using memory fallback.`);
          this.hasError = true;
          return this.fallbackMemory.getDoc(col, id);
        }
        return null;
      }
      return data || null;
    } catch (err: any) {
      console.warn(`[SUPABASE] getDoc(${col}) fallback:`, err?.message || err);
      return this.fallbackMemory.getDoc(col, id);
    }
  }

  async setDoc(col: string, id: string, data: any) {
    if (this.hasError || !this.supabase) {
      return this.fallbackMemory.setDoc(col, id, data);
    }
    try {
      const { error } = await this.supabase.from(col).upsert({ ...data, id });
      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          console.warn(`[SUPABASE] Table "${col}" missing on setDoc (${error.message}); switching to memory fallback.`);
          this.hasError = true;
          return this.fallbackMemory.setDoc(col, id, data);
        }
        throw error;
      }
    } catch (err: any) {
      if (isMissingTableOrSchemaError(err)) {
        this.hasError = true;
        return this.fallbackMemory.setDoc(col, id, data);
      }
      throw err;
    }
  }

  async addDoc(col: string, data: any) {
    if (this.hasError || !this.supabase) {
      return this.fallbackMemory.addDoc(col, data);
    }
    try {
      const { data: record, error } = await this.supabase
        .from(col)
        .insert(data)
        .select()
        .single();
      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          this.hasError = true;
          return this.fallbackMemory.addDoc(col, data);
        }
        throw error;
      }
      return record.id;
    } catch (err: any) {
      if (isMissingTableOrSchemaError(err)) {
        this.hasError = true;
        return this.fallbackMemory.addDoc(col, data);
      }
      throw err;
    }
  }

  async updateDoc(col: string, id: string, data: any) {
    if (this.hasError || !this.supabase) {
      return this.fallbackMemory.updateDoc(col, id, data);
    }
    const { error } = await this.supabase.from(col).update(data).eq("id", id);
    if (error) {
      if (isMissingTableOrSchemaError(error)) {
        this.hasError = true;
        return this.fallbackMemory.updateDoc(col, id, data);
      }
      throw error;
    }
  }

  async deleteDoc(col: string, id: string) {
    if (this.hasError || !this.supabase) {
      return this.fallbackMemory.deleteDoc(col, id);
    }
    const { error } = await this.supabase.from(col).delete().eq("id", id);
    if (error) {
      if (isMissingTableOrSchemaError(error)) {
        this.hasError = true;
        return this.fallbackMemory.deleteDoc(col, id);
      }
      throw error;
    }
  }

  async getDocs(col: string) {
    if (this.hasError || !this.supabase) {
      return this.fallbackMemory.getDocs(col);
    }
    try {
      const { data, error } = await this.supabase
        .from(col)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTableOrSchemaError(error)) {
          this.hasError = true;
          return this.fallbackMemory.getDocs(col);
        }
        const retry = await this.supabase.from(col).select("*");
        return retry.error ? [] : retry.data || [];
      }
      return data || [];
    } catch {
      return this.fallbackMemory.getDocs(col);
    }
  }
}
