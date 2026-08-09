import { Sequelize, DataTypes } from "sequelize";
import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../index.js";

export class PolarDBAdapter implements DatabaseAdapter {
  private sequelize: Sequelize;
  private models: Record<string, any> = {};
  private initPromise: Promise<void>;
  private CORE_TABLES = ["users", "erp_orders", "daily_logs", "buyer_data_bank", "audit_logs"];

  constructor() {
    let connectionString = process.env.POLARDB_DATABASE_URL || process.env.DATABASE_URL || "";
    
    // Sanitize quotes if present
    connectionString = connectionString.replace(/^['"](.*)['"]$/, "$1");

    if (!connectionString) {
      console.warn("[POLARDB] Warning: POLARDB_DATABASE_URL/DATABASE_URL not specified. Falling back to default postgres local connection.");
      connectionString = "postgres://postgres:postgres@localhost:5432/postgres";
    }

    console.log("[POLARDB] Initializing Sequelize with PolarDB/PostgreSQL...");

    this.sequelize = new Sequelize(connectionString, {
      dialect: "postgres",
      logging: false,
      dialectOptions: {
        ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : {
          rejectUnauthorized: false
        }
      }
    });

    this.initPromise = this.init();
  }

  private async init() {
    try {
      await this.sequelize.authenticate();
      console.log("[POLARDB] Successfully connected and authenticated with PolarDB Database.");

      // 1. Define CORE models
      this.models["users"] = this.sequelize.define("users", {
        id: { type: DataTypes.STRING, primaryKey: true },
        username: { type: DataTypes.STRING, unique: true, allowNull: false },
        password_hash: { type: DataTypes.STRING, allowNull: false },
        role: { type: DataTypes.STRING, defaultValue: "viewer" },
        status: { type: DataTypes.STRING, defaultValue: "active" },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
      }, {
        tableName: "users",
        timestamps: false
      });

      this.models["erp_orders"] = this.sequelize.define("erp_orders", {
        id: { type: DataTypes.STRING, primaryKey: true },
        buyer: { type: DataTypes.STRING },
        erp_date: { type: DataTypes.STRING },
        erp_ship_date: { type: DataTypes.STRING },
        job_ref: { type: DataTypes.STRING },
        style_no: { type: DataTypes.STRING },
        file_no: { type: DataTypes.STRING },
        color: { type: DataTypes.STRING },
        cpl_qty_kg: { type: DataTypes.DOUBLE },
        order_qty: { type: DataTypes.INTEGER },
        sew_floor: { type: DataTypes.STRING },
        floor: { type: DataTypes.STRING },
        item: { type: DataTypes.STRING },
        wash_type: { type: DataTypes.STRING },
        wash_status: { type: DataTypes.STRING, defaultValue: "Pending" },
        status: { type: DataTypes.STRING, defaultValue: "New" },
        plan: { type: DataTypes.STRING },
        print_emb: { type: DataTypes.STRING },
        source_ref: { type: DataTypes.STRING },
        remarks: { type: DataTypes.TEXT },
        uploaded_by: { type: DataTypes.STRING },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
      }, {
        tableName: "erp_orders",
        timestamps: false
      });

      this.models["daily_logs"] = this.sequelize.define("daily_logs", {
        id: { type: DataTypes.STRING, primaryKey: true },
        erp_order: { type: DataTypes.STRING },
        log_date: { type: DataTypes.STRING },
        received_qty: { type: DataTypes.DOUBLE },
        delivered_qty: { type: DataTypes.DOUBLE },
        unit: { type: DataTypes.STRING },
        ready_for_delivery_qty: { type: DataTypes.DOUBLE },
        remarks: { type: DataTypes.TEXT },
        created_by: { type: DataTypes.STRING },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
      }, {
        tableName: "daily_logs",
        timestamps: false
      });

      this.models["buyer_data_bank"] = this.sequelize.define("buyer_data_bank", {
        id: { type: DataTypes.STRING, primaryKey: true },
        erp_order: { type: DataTypes.STRING },
        buyer: { type: DataTypes.STRING },
        file_no: { type: DataTypes.STRING },
        style_no: { type: DataTypes.STRING },
        color: { type: DataTypes.STRING },
        order_qty: { type: DataTypes.INTEGER },
        total_received: { type: DataTypes.DOUBLE },
        total_delivered: { type: DataTypes.DOUBLE },
        close_date: { type: DataTypes.STRING },
        final_delivered_qty: { type: DataTypes.DOUBLE },
        wash_type: { type: DataTypes.STRING },
        closed_by: { type: DataTypes.STRING },
        is_locked: { type: DataTypes.INTEGER, defaultValue: 1 },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
      }, {
        tableName: "buyer_data_bank",
        timestamps: false
      });

      this.models["audit_logs"] = this.sequelize.define("audit_logs", {
        id: { type: DataTypes.STRING, primaryKey: true },
        action: { type: DataTypes.STRING },
        userId: { type: DataTypes.STRING },
        ip: { type: DataTypes.STRING },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
      }, {
        tableName: "audit_logs",
        timestamps: false
      });

      // Synchronize all defined core models
      for (const modelKey of this.CORE_TABLES) {
        await this.models[modelKey].sync();
      }

      console.log("[POLARDB] Core tables synchronized successfully.");
    } catch (err: any) {
      console.error("[POLARDB] Connection or Sync Error:", err.message);
    }
  }

  private async ensureModel(collection: string) {
    await this.initPromise;
    const modelKey = collection.toLowerCase();
    if (this.models[modelKey]) return this.models[modelKey];

    // Define generic dynamic model for other tables
    this.models[modelKey] = this.sequelize.define(modelKey, {
      id: { type: DataTypes.STRING, primaryKey: true },
      data: { type: DataTypes.TEXT },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    }, {
      tableName: modelKey,
      timestamps: false
    });

    await this.models[modelKey].sync();
    return this.models[modelKey];
  }

  async getDoc(collection: string, id: string): Promise<any> {
    await this.initPromise;
    const modelKey = collection.toLowerCase();

    if (modelKey === "users") {
      const model = this.models["users"];
      // Find by ID or Username
      const user = await model.findOne({
        where: {
          id: id
        }
      }) || await model.findOne({
        where: {
          username: id.toLowerCase()
        }
      });
      return user ? user.get({ plain: true }) : null;
    }

    if (this.CORE_TABLES.includes(modelKey)) {
      const model = this.models[modelKey];
      const doc = await model.findByPk(id);
      return doc ? doc.get({ plain: true }) : null;
    }

    const model = await this.ensureModel(modelKey);
    const doc = await model.findByPk(id);
    if (!doc) return null;

    const plain = doc.get({ plain: true });
    return { id: plain.id, ...JSON.parse(plain.data) };
  }

  async setDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const modelKey = collection.toLowerCase();

    if (this.CORE_TABLES.includes(modelKey)) {
      const model = this.models[modelKey];
      const existing = await model.findByPk(id);
      const cleanData = { ...data };
      delete cleanData.id;

      if (existing) {
        await model.update({ ...cleanData, updated_at: new Date() }, { where: { id } });
      } else {
        await model.create({ ...cleanData, id });
      }
    } else {
      const model = await this.ensureModel(modelKey);
      const existing = await model.findByPk(id);
      const jsonStr = JSON.stringify(data);

      if (existing) {
        await model.update({ data: jsonStr, updated_at: new Date() }, { where: { id } });
      } else {
        await model.create({ id, data: jsonStr });
      }
    }
  }

  async addDoc(collection: string, data: any): Promise<string> {
    const id = randomUUID();
    await this.setDoc(collection, id, { ...data, id });
    return id;
  }

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    await this.initPromise;
    const modelKey = collection.toLowerCase();
    const existing = await this.getDoc(collection, id);
    if (!existing) throw new Error(`Document with ID ${id} not found in collection ${collection}`);
    
    await this.setDoc(collection, id, { ...existing, ...data });
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    await this.initPromise;
    const modelKey = collection.toLowerCase();

    if (this.CORE_TABLES.includes(modelKey)) {
      const model = this.models[modelKey];
      await model.destroy({ where: { id } });
    } else {
      const model = await this.ensureModel(modelKey);
      await model.destroy({ where: { id } });
    }
  }

  async getDocs(collection: string): Promise<any[]> {
    await this.initPromise;
    const modelKey = collection.toLowerCase();

    if (this.CORE_TABLES.includes(modelKey)) {
      const model = this.models[modelKey];
      const results = await model.findAll({ order: [["created_at", "DESC"]] });
      return results.map((r: any) => r.get({ plain: true }));
    }

    const model = await this.ensureModel(modelKey);
    const results = await model.findAll({ order: [["created_at", "DESC"]] });
    return results.map((r: any) => {
      const plain = r.get({ plain: true });
      return { id: plain.id, ...JSON.parse(plain.data) };
    });
  }
}
