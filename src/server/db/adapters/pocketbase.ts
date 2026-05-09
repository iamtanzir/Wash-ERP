import * as PocketBasePkg from 'pocketbase';
const PocketBase = (PocketBasePkg as any).default || PocketBasePkg;
import type { DatabaseAdapter } from "../index.js";

export class PocketBaseAdapter implements DatabaseAdapter {
  private pb: any;
  private initPromise: Promise<void>;

  constructor() {
    let url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
    
    // Sanitize quotes
    url = url.replace(/^['"](.*)['"]$/, '$1');

    // @ts-ignore
    this.pb = new PocketBase(url);
    this.initPromise = this.init();
  }

  private async init() {
    // PocketBase usually requires manual collection setup or schema import.
    // If we want it to be "offline ready", we'd need a local pocketbase binary running,
    // which is not possible in this container without complexity.
    // We assume the service is reachable at POCKETBASE_URL.
    console.log("[POCKETBASE] Adapter initialized.");
  }

  async getDoc(col: string, id: string) {
    await this.initPromise;
    try {
      // In PocketBase, we use 'getOne' for IDs.
      const record = await this.pb.collection(col).getOne(id);
      return { id: record.id, ...record };
    } catch (e) {
      // ERP specific: try query by username if it's the users collection
      if (col === 'users') {
          try {
              const record = await this.pb.collection(col).getFirstListItem(`username="${id}"`);
              return { id: record.id, ...record };
          } catch {
              return null;
          }
      }
      return null;
    }
  }

  async setDoc(col: string, id: string, data: any) {
    await this.initPromise;
    const existing = await this.getDoc(col, id);
    if (existing) {
      const { id: _, ...updateData } = data;
      await this.pb.collection(col).update(existing.id, updateData);
    } else {
      await this.pb.collection(col).create({ ...data, id });
    }
  }

  async addDoc(col: string, data: any) {
    await this.initPromise;
    const record = await this.pb.collection(col).create(data);
    return record.id;
  }

  async updateDoc(col: string, id: string, data: any) {
    await this.initPromise;
    const existing = await this.getDoc(col, id);
    if (!existing) throw new Error("Record not found");
    const { id: _, ...updateData } = data;
    await this.pb.collection(col).update(existing.id, updateData);
  }

  async deleteDoc(col: string, id: string) {
    await this.initPromise;
    const existing = await this.getDoc(col, id);
    if (existing) {
      await this.pb.collection(col).delete(existing.id);
    }
  }

  async getDocs(col: string) {
    await this.initPromise;
    try {
      const records = await this.pb.collection(col).getFullList({
        sort: '-created',
      });
      return records.map((r: any) => ({ id: r.id, ...r }));
    } catch (e) {
      console.warn(`[POCKETBASE] Error fetching ${col}:`, e);
      return [];
    }
  }
}
