export interface RpcConnectionConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

interface JsonRpcResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: {
      name?: string;
      debug?: string;
      message?: string;
      arguments?: any[];
    };
  };
}

function normalizeServerUrl(rawUrl: string): string {
  let clean = rawUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean;
}

async function callErpJsonRpc<T = any>(
  baseUrl: string,
  service: "common" | "object" | "db",
  method: string,
  args: any[]
): Promise<T> {
  const endpoint = `${normalizeServerUrl(baseUrl)}/jsonrpc`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
        id: Date.now(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`);
    }

    const payload = (await res.json()) as JsonRpcResponse<T>;
    if (payload.error) {
      const detail = payload.error.data?.message || payload.error.message || "JSON-RPC error";
      throw new Error(detail);
    }

    return payload.result as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function authenticateRpcServer(
  config: RpcConnectionConfig
): Promise<{ uid: number; serverVersion: string; modules: { name: string; shortdesc: string }[] }> {
  const versionInfo = await callErpJsonRpc<any>(config.url, "common", "version", []);
  const uid = await callErpJsonRpc<number | false>(config.url, "common", "authenticate", [
    config.db,
    config.username,
    config.password,
    {},
  ]);

  if (!uid || typeof uid !== "number") {
    throw new Error("RPC authentication failed. Check database name, username, or API key/password.");
  }

  let modules: { name: string; shortdesc: string }[] = [];
  try {
    modules = await executeRpcKw<{ name: string; shortdesc: string }[]>(
      config,
      uid,
      "ir.module.module",
      "search_read",
      [[["state", "=", "installed"]]],
      { fields: ["name", "shortdesc"], limit: 50 }
    );
  } catch {
    modules = [];
  }

  return {
    uid,
    serverVersion: versionInfo?.server_version || "Open-Source ERP CE",
    modules,
  };
}

export async function executeRpcKw<T = any>(
  config: RpcConnectionConfig,
  uid: number,
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {}
): Promise<T> {
  return callErpJsonRpc<T>(config.url, "object", "execute_kw", [
    config.db,
    uid,
    config.password,
    model,
    method,
    args,
    kwargs,
  ]);
}

export async function pushBuyersToRpc(
  config: RpcConnectionConfig,
  uid: number,
  buyerNames: string[]
): Promise<{ created: number; existing: number }> {
  const uniqueBuyers = Array.from(new Set(buyerNames.map((b) => String(b || "").trim()).filter(Boolean)));
  let created = 0;
  let existing = 0;

  for (const name of uniqueBuyers) {
    const found = await executeRpcKw<number[]>(
      config,
      uid,
      "res.partner",
      "search",
      [[["name", "=", name]]],
      { limit: 1 }
    );
    if (found && found.length > 0) {
      existing++;
    } else {
      await executeRpcKw<number>(config, uid, "res.partner", "create", [
        {
          name,
          is_company: true,
          customer_rank: 1,
          comment: "Synced from Industrial Garment Washing ERP (RMG)",
        },
      ]);
      created++;
    }
  }

  return { created, existing };
}

export async function pullRpcRecords(
  config: RpcConnectionConfig,
  uid: number,
  model: "res.partner" | "mrp.production" | "purchase.order" | "hr.employee" | "maintenance.equipment",
  limit = 100
): Promise<Record<string, any>[]> {
  const fieldsByModel: Record<string, string[]> = {
    "res.partner": ["id", "name", "email", "phone", "city", "is_company"],
    "mrp.production": ["id", "name", "product_qty", "state", "date_start"],
    "purchase.order": ["id", "name", "amount_total", "state", "date_order"],
    "hr.employee": ["id", "name", "work_email", "job_title"],
    "maintenance.equipment": ["id", "name", "serial_no", "category_id"],
  };

  const fields = fieldsByModel[model] || ["id", "name"];
  return executeRpcKw<Record<string, any>[]>(
    config,
    uid,
    model,
    "search_read",
    [[]],
    { fields, limit }
  );
}

export function generateErpDockerCompose(options?: {
  pgPass?: string;
  httpPort?: number;
}): string {
  const pgPass = options?.pgPass || "rmg_wash_pg_secret";
  const port = options?.httpPort || 3000;

  return `# ============================================================================
# Industrial Garment Washing ERP (RMG) - Self-Hosted Production Stack
# Runs 100% Free on Oracle Cloud Always Free VM, Ubuntu PC, or Windows Docker
# ============================================================================
services:
  postgres:
    image: postgres:16-alpine
    container_name: rmg_wash_postgres
    environment:
      - POSTGRES_DB=erp_db
      - POSTGRES_USER=erp_user
      - POSTGRES_PASSWORD=${pgPass}
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - rmg-db-data:/var/lib/postgresql/data/pgdata
    restart: unless-stopped

  wash-erp:
    image: node:22-alpine
    container_name: rmg_wash_erp_app
    working_dir: /app
    depends_on:
      - postgres
    ports:
      - "${port}:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_MODE=parquet
      - PARQUET_DIR=/app/data/parquet
    volumes:
      - ./:/app
      - rmg-parquet-data:/app/data/parquet
    command: sh -c "npm install && npm run build && npm start"
    restart: unless-stopped

volumes:
  rmg-db-data:
  rmg-parquet-data:
`;
}
