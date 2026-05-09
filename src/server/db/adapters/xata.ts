import * as xataPkg from "@xata.io/client";
const { buildClient } = (xataPkg as any).default || xataPkg;
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.js";

export class XataAdapter implements DatabaseAdapter {
  private xata: any;
  private initPromise: Promise<void>;

  constructor() {
    let apiKey = process.env.XATA_API_KEY || "";
    let dbUrl = process.env.XATA_DATABASE_URL || "";

    // Sanitize quotes
    apiKey = apiKey.replace(/^['"](.*)['"]$/, '$1');
    dbUrl = dbUrl.replace(/^['"](.*)['"]$/, '$1');

    if (!apiKey || !dbUrl) {
      console.warn("[XATA] Missing environment variables. Connection may fail.");
    }

    // Isolated client construction
    const XataClient = buildClient();
    this.xata = new XataClient({
      apiKey,
      databaseURL: dbUrl,
    });

    this.initPromise = this.init();
  }

  private async init() {
    // Xata usually handles schema via their portal, 
    // but we log that we are using it.
    console.log("[XATA] Connected and isolated.");
  }

  async getDoc(collection: string, id: string): Promise<any> {
    await this.initPromise;
    const record = await this.xata.db[collection].read(id);
    return record || null;
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    await this.xata.db[collection].createOrUpdate(id, data);
  }

  async addDoc(collection: string, data: any): Promise<string> {
    await this.initPromise;
    const record = await this.xata.db[collection].create(data);
    return record.id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    await this.xata.db[collection].update(id, data);
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    await this.initPromise;
    await this.xata.db[collection].delete(id);
  }

  async getDocs(collection: string): Promise<any[]> {
    await this.initPromise;
    const records = await this.xata.db[collection].getAll();
    return records;
  }
}
