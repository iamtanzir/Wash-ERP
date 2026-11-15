import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.js";
import { readParquetFile, writeParquetFileAtomic, type ParquetCodec } from "../parquetEngine.js";

export class ParquetAdapter implements DatabaseAdapter {
  private baseDir: string;
  private codec: ParquetCodec;
  private collections: Map<string, Map<string, any>> = new Map();
  private initPromise: Promise<void>;
  private writeChains: Map<string, Promise<void>> = new Map();
  private dirtyFlags: Map<string, boolean> = new Map();

  constructor(customDir?: string) {
    const requestedDir =
      customDir ||
      process.env.PARQUET_DIR ||
      process.env.LOCAL_PARQUET_DIR ||
      (process.env.GDRIVE_DB_PATH && !process.env.GDRIVE_DB_PATH.endsWith(".sqlite")
        ? process.env.GDRIVE_DB_PATH
        : "") ||
      path.resolve(process.cwd(), "data", "parquet");

    this.codec = (process.env.PARQUET_CODEC as ParquetCodec) || "SNAPPY";

    let targetDir = path.resolve(requestedDir);
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      // Verify writable
      const probe = path.join(targetDir, `.probe_${process.pid}`);
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
    } catch {
      targetDir = path.resolve("/tmp", "erp_parquet");
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {}
    }

    this.baseDir = targetDir;
    console.log(`[PARQUET DB] ⚡ Initializing Apache Parquet Columnar Storage (${this.codec}) at: ${this.baseDir}`);
    this.initPromise = this.loadAllCollections();
  }

  public getDirectory(): string {
    return this.baseDir;
  }

  private getFilePath(collection: string): string {
    const safeName = collection.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.baseDir, `${safeName}.parquet`);
  }

  private getCollectionMap(collection: string): Map<string, any> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map());
    }
    return this.collections.get(collection)!;
  }

  private async loadAllCollections(): Promise<void> {
    try {
      if (!fs.existsSync(this.baseDir)) return;
      const files = fs.readdirSync(this.baseDir).filter((f) => f.endsWith(".parquet"));
      for (const file of files) {
        const colName = file.replace(/\.parquet$/, "");
        const fullPath = path.join(this.baseDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size === 0) continue;
          const { rows, readTimeMs } = await readParquetFile(fullPath);
          const colMap = this.getCollectionMap(colName);
          for (const row of rows) {
            if (row && row.id) {
              colMap.set(String(row.id), row);
            }
          }
          console.log(`[PARQUET DB] 📦 Loaded ${rows.length} rows from ${file} in ${readTimeMs}ms`);
        } catch (err: any) {
          console.warn(`[PARQUET DB] ⚠️ Could not load ${file}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error("[PARQUET DB] 🚨 Failed scanning Parquet directory:", err.message);
    }
  }

  private async persistCollection(collection: string): Promise<void> {
    this.dirtyFlags.set(collection, true);

    const existingChain = this.writeChains.get(collection) || Promise.resolve();
    const nextChain = existingChain.then(async () => {
      if (!this.dirtyFlags.get(collection)) return;
      this.dirtyFlags.set(collection, false);

      const colMap = this.getCollectionMap(collection);
      const rows = Array.from(colMap.values());
      const filePath = this.getFilePath(collection);
      await writeParquetFileAtomic(filePath, rows, {
        codec: this.codec,
        tableName: collection,
      });
    });

    // Keep chain non-rejected for subsequent writes
    this.writeChains.set(
      collection,
      nextChain.catch((err) => {
        console.error(`[PARQUET DB] 🚨 Write error for ${collection}.parquet:`, err.message);
      })
    );

    await nextChain;
  }

  async getDoc(collection: string, id: string): Promise<any> {
    await this.initPromise;
    const colMap = this.getCollectionMap(collection);

    if (collection === "users") {
      if (colMap.has(id)) return colMap.get(id);
      const lowerId = id.toLowerCase();
      for (const user of colMap.values()) {
        if (String(user.id || "").toLowerCase() === lowerId || String(user.username || "").toLowerCase() === lowerId) {
          return user;
        }
      }
      return null;
    }

    return colMap.get(id) || null;
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const colMap = this.getCollectionMap(collection);
    const existing = colMap.get(id) || {};
    const now = new Date().toISOString();

    colMap.set(id, {
      ...existing,
      ...data,
      id,
      created_at: existing.created_at || data.created_at || now,
      updated_at: now,
    });

    await this.persistCollection(collection);
  }

  async addDoc(collection: string, data: any): Promise<string> {
    await this.initPromise;
    const id = data.id || randomUUID();
    await this.setDoc(collection, id, data);
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const colMap = this.getCollectionMap(collection);
    const existing = colMap.get(id);
    if (!existing) throw new Error(`Document ${id} not found in ${collection}`);

    colMap.set(id, {
      ...existing,
      ...data,
      id,
      updated_at: new Date().toISOString(),
    });

    await this.persistCollection(collection);
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    await this.initPromise;
    const colMap = this.getCollectionMap(collection);
    colMap.delete(id);
    await this.persistCollection(collection);
  }

  async getDocs(collection: string, _filters?: any[]): Promise<any[]> {
    await this.initPromise;
    const colMap = this.getCollectionMap(collection);
    const docs = Array.from(colMap.values());
    if (collection === "erp_orders" || collection === "daily_logs" || collection === "buyer_data_bank") {
      docs.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
    return docs;
  }
}
