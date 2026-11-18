import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.js";

export class MemoryAdapter implements DatabaseAdapter {
  private collections: Map<string, Map<string, any>> = new Map();

  constructor() {
    console.log("[MEMORY DB] 🧠 In-Memory Database initialized.");
  }

  private getCollectionMap(collection: string): Map<string, any> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map());
    }
    return this.collections.get(collection)!;
  }

  async getDoc(collection: string, id: string): Promise<any> {
    const colMap = this.getCollectionMap(collection);
    
    if (collection === "users") {
      const lowerId = id.toLowerCase();
      if (colMap.has(lowerId)) return colMap.get(lowerId);
      for (const user of colMap.values()) {
        if (user.username?.toLowerCase() === lowerId) return user;
      }
      return null;
    }

    return colMap.get(id) || null;
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    const colMap = this.getCollectionMap(collection);
    const existing = colMap.get(id) || {};
    colMap.set(id, {
      ...existing,
      ...data,
      id,
      updated_at: new Date().toISOString(),
      created_at: existing.created_at || new Date().toISOString()
    });
  }

  async addDoc(collection: string, data: any): Promise<string> {
    const id = data.id || randomUUID();
    await this.setDoc(collection, id, data);
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    const colMap = this.getCollectionMap(collection);
    const existing = colMap.get(id);
    if (!existing) throw new Error(`Document ${id} not found in ${collection}`);
    colMap.set(id, {
      ...existing,
      ...data,
      updated_at: new Date().toISOString()
    });
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    const colMap = this.getCollectionMap(collection);
    colMap.delete(id);
  }

  async getDocs(collection: string): Promise<any[]> {
    const colMap = this.getCollectionMap(collection);
    return Array.from(colMap.values());
  }
}
