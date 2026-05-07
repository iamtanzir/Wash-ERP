import PocketBase from 'pocketbase';
import type { DatabaseAdapter } from "../index.ts";

export class PocketBaseAdapter implements DatabaseAdapter {
  private pb: PocketBase;

  constructor() {
    // Falls back to a default local IP if not provided
    const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
    this.pb = new PocketBase(url);
  }

  async getDoc(col: string, id: string) {
    try {
      const record = await this.pb.collection(col).getOne(id);
      return { id: record.id, ...record };
    } catch (e) {
      // In PocketBase, if the ID is a username and we are using it as unique key
      // we might need to query by name instead. For simplicity, we assume IDs.
      // But if we use username as ID in ERP, we query by filter.
      try {
        const record = await this.pb.collection(col).getFirstListItem(`username="${id}"`);
        return { id: record.id, ...record };
      } catch {
        return null;
      }
    }
  }

  async setDoc(col: string, id: string, data: any) {
    // If it exists, update; else, create
    const existing = await this.getDoc(col, id);
    if (existing) {
      await this.pb.collection(col).update(existing.id, data);
    } else {
      await this.pb.collection(col).create({ ...data, id });
    }
  }

  async addDoc(col: string, data: any) {
    const record = await this.pb.collection(col).create(data);
    return record.id;
  }

  async updateDoc(col: string, id: string, data: any) {
    const existing = await this.getDoc(col, id);
    if (!existing) throw new Error("Record not found");
    await this.pb.collection(col).update(existing.id, data);
  }

  async deleteDoc(col: string, id: string) {
    const existing = await this.getDoc(col, id);
    if (existing) {
      await this.pb.collection(col).delete(existing.id);
    }
  }

  async getDocs(col: string) {
    const records = await this.pb.collection(col).getFullList({
      sort: '-created',
    });
    return records.map(r => ({ id: r.id, ...r }));
  }
}
