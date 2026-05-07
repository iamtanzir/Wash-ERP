import * as supabasePkg from "@supabase/supabase-js";
const { createClient } = (supabasePkg as any).default || supabasePkg;
import type { DatabaseAdapter } from "../index.ts";

export class SupabaseAdapter implements DatabaseAdapter {
  private supabase: any;

  constructor() {
    let url = process.env.SUPABASE_URL || "";
    let key = process.env.SUPABASE_ANON_KEY || "";
    
    // Sanitize quotes
    url = url.replace(/^['"](.*)['"]$/, '$1');
    key = key.replace(/^['"](.*)['"]$/, '$1');

    this.supabase = createClient(url, key);
  }

  async getDoc(col: string, id: string) {
    const { data, error } = await this.supabase
      .from(col)
      .select("*")
      .or(`id.eq.${id},username.eq.${id}`)
      .single();
    if (error || !data) return null;
    return data;
  }

  async setDoc(col: string, id: string, data: any) {
    const { error } = await this.supabase
      .from(col)
      .upsert({ ...data, id });
    if (error) throw error;
  }

  async addDoc(col: string, data: any) {
    const { data: record, error } = await this.supabase
      .from(col)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return record.id;
  }

  async updateDoc(col: string, id: string, data: any) {
    const { error } = await this.supabase
      .from(col)
      .update(data)
      .eq('id', id);
    if (error) throw error;
  }

  async deleteDoc(col: string, id: string) {
    const { error } = await this.supabase
      .from(col)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getDocs(col: string) {
    const { data, error } = await this.supabase
      .from(col)
      .select("*")
      .order('created_at', { ascending: false });
    if (error) return [];
    return data;
  }
}
