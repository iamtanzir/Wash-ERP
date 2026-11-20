/**
 * ERP Connectors & Oracle APEX Integration Hub
 * Supports real live API protocols:
 * - ERPNext / Frappe REST API (/api/resource/*, /api/method/*)
 * - Dolibarr ERP & CRM REST API (/api/index.php/* with DOLAPIKEY)
 * - Oracle APEX Live HTTP Probe & ORDS REST Fetch
 * - Self-Hosted Docker Compose Stack Generators (Odoo 18, ERPNext v15, Dolibarr 20)
 */

export interface ErpNextConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  company?: string;
}

export interface DolibarrConfig {
  url: string;
  apiKey: string;
}

export interface ApexConnectionConfig {
  url: string;
  ordsBaseUrl?: string;
  workspace?: string;
  appId?: string;
  pageId?: string;
  authHeader?: string;
}

export interface ApexProbeResult {
  reachable: boolean;
  url: string;
  statusCode: number | null;
  statusText: string;
  latencyMs: number;
  title: string | null;
  serverHeader: string | null;
  apexVersion: string | null;
  appId: string | null;
  pageId: string | null;
  workspace: string | null;
  xFrameOptions: string | null;
  iframeBlocked: boolean;
  checkedAt: string;
  error?: string;
}

function normalizeUrl(raw: string): string {
  let clean = String(raw || "").trim().replace(/\/+$/, "");
  if (clean && !/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean;
}

function assertSafeHttpUrl(raw: string): URL {
  const normalized = normalizeUrl(raw);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Invalid URL format. Include http:// or https://");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS endpoints are supported.");
  }
  return parsed;
}

// ============================================================================
// 1. ERPNext / Frappe REST API Connector
// ============================================================================

async function callErpNextApi<T = any>(
  config: ErpNextConfig,
  endpointPath: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: any; timeoutMs?: number } = {}
): Promise<T> {
  const base = assertSafeHttpUrl(config.url).toString().replace(/\/+$/, "");
  const path = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 12000);

  try {
    const res = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `token ${config.apiKey.trim()}:${config.apiSecret.trim()}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.exception ||
        json?._server_messages ||
        json?.message ||
        `ERPNext HTTP ${res.status}: ${res.statusText}`;
      throw new Error(String(msg).slice(0, 260));
    }

    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function testErpNextConnection(config: ErpNextConfig): Promise<{
  loggedUser: string;
  versions: Record<string, any>;
}> {
  const userRes = await callErpNextApi<{ message: string }>(
    config,
    "/api/method/frappe.auth.get_logged_user"
  );
  let versions: Record<string, any> = {};
  try {
    const verRes = await callErpNextApi<{ message: Record<string, any> }>(
      config,
      "/api/method/frappe.utils.change_log.get_versions"
    );
    versions = verRes?.message || {};
  } catch {
    versions = { erpnext: { title: "ERPNext", version: "Connected" } };
  }

  return {
    loggedUser: userRes?.message || "Authenticated User",
    versions,
  };
}

export async function pushBuyersToErpNext(
  config: ErpNextConfig,
  buyerNames: string[]
): Promise<{ created: number; existing: number; errors: string[] }> {
  const uniqueBuyers = Array.from(
    new Set(buyerNames.map((b) => String(b || "").trim()).filter(Boolean))
  );
  let created = 0;
  let existing = 0;
  const errors: string[] = [];

  for (const name of uniqueBuyers) {
    try {
      const query = encodeURIComponent(JSON.stringify([["customer_name", "=", name]]));
      const found = await callErpNextApi<{ data: any[] }>(
        config,
        `/api/resource/Customer?filters=${query}&limit_page_length=1`
      );
      if (Array.isArray(found?.data) && found.data.length > 0) {
        existing++;
      } else {
        await callErpNextApi(config, "/api/resource/Customer", {
          method: "POST",
          body: {
            customer_name: name,
            customer_type: "Company",
            customer_group: "Commercial",
            territory: "All Territories",
          },
        });
        created++;
      }
    } catch (err: any) {
      errors.push(`${name}: ${err?.message || "Failed"}`);
    }
  }

  return { created, existing, errors };
}

export type ErpNextDoctype =
  | "Customer"
  | "Work Order"
  | "Item"
  | "Purchase Order"
  | "Employee";

export async function pullErpNextDoctype(
  config: ErpNextConfig,
  doctype: ErpNextDoctype,
  limit = 50
): Promise<Record<string, any>[]> {
  const fieldsByDoctype: Record<ErpNextDoctype, string[]> = {
    Customer: ["name", "customer_name", "customer_group", "territory", "customer_type"],
    "Work Order": ["name", "production_item", "qty", "produced_qty", "status", "planned_start_date"],
    Item: ["name", "item_code", "item_name", "item_group", "stock_uom"],
    "Purchase Order": ["name", "supplier", "grand_total", "status", "transaction_date"],
    Employee: ["name", "employee_name", "designation", "department", "status"],
  };

  const fields = encodeURIComponent(JSON.stringify(fieldsByDoctype[doctype] || ["name"]));
  const encodedDoctype = encodeURIComponent(doctype);
  const res = await callErpNextApi<{ data: Record<string, any>[] }>(
    config,
    `/api/resource/${encodedDoctype}?fields=${fields}&limit_page_length=${Math.min(200, Math.max(1, limit))}`
  );

  return Array.isArray(res?.data) ? res.data : [];
}

// ============================================================================
// 2. Dolibarr ERP & CRM REST API Connector (/api/index.php/*)
// ============================================================================

async function callDolibarrApi<T = any>(
  config: DolibarrConfig,
  endpointPath: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: any; timeoutMs?: number } = {}
): Promise<T> {
  const rawBase = assertSafeHttpUrl(config.url).toString().replace(/\/+$/, "");
  const apiBase = rawBase.endsWith("/api/index.php")
    ? rawBase
    : `${rawBase}/api/index.php`;
  const path = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 12000);

  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: options.method || "GET",
      headers: {
        DOLAPIKEY: config.apiKey.trim(),
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.error?.message ||
        json?.message ||
        `Dolibarr HTTP ${res.status}: ${res.statusText}`;
      throw new Error(String(msg).slice(0, 260));
    }

    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function testDolibarrConnection(config: DolibarrConfig): Promise<{
  dolibarrVersion: string;
  environment: string;
}> {
  const status = await callDolibarrApi<any>(config, "/status");
  return {
    dolibarrVersion: status?.success?.dolibarr_version || status?.dolibarr_version || "Dolibarr REST",
    environment: status?.success?.environment || "production",
  };
}

export async function pushBuyersToDolibarr(
  config: DolibarrConfig,
  buyerNames: string[]
): Promise<{ created: number; existing: number; errors: string[] }> {
  const uniqueBuyers = Array.from(
    new Set(buyerNames.map((b) => String(b || "").trim()).filter(Boolean))
  );
  let created = 0;
  let existing = 0;
  const errors: string[] = [];

  let existingList: any[] = [];
  try {
    const res = await callDolibarrApi<any[]>(config, "/thirdparties?limit=250");
    if (Array.isArray(res)) existingList = res;
  } catch {
    existingList = [];
  }

  const existingNames = new Set(
    existingList.map((t) => String(t?.name || "").trim().toLowerCase())
  );

  for (const name of uniqueBuyers) {
    if (existingNames.has(name.toLowerCase())) {
      existing++;
      continue;
    }
    try {
      await callDolibarrApi(config, "/thirdparties", {
        method: "POST",
        body: {
          name,
          client: "1",
          code_client: "-1",
          note_private: "Synced from INCTL Wash ERP",
        },
      });
      created++;
    } catch (err: any) {
      errors.push(`${name}: ${err?.message || "Failed"}`);
    }
  }

  return { created, existing, errors };
}

export type DolibarrResource =
  | "thirdparties"
  | "products"
  | "orders"
  | "supplierorders"
  | "users";

export async function pullDolibarrResource(
  config: DolibarrConfig,
  resource: DolibarrResource,
  limit = 50
): Promise<Record<string, any>[]> {
  const res = await callDolibarrApi<Record<string, any>[]>(
    config,
    `/${resource}?limit=${Math.min(200, Math.max(1, limit))}`
  );
  return Array.isArray(res) ? res : [];
}

// ============================================================================
// 3. Oracle APEX Live Server Probe & ORDS REST Fetcher
// ============================================================================

export async function probeOracleApexServer(rawUrl: string): Promise<ApexProbeResult> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const parsedUrl = assertSafeHttpUrl(rawUrl);
  const targetUrl = parsedUrl.toString();

  // Extract ?p=APP:PAGE from Oracle APEX URL if present
  const pParam = parsedUrl.searchParams.get("p") || "";
  const pParts = pParam.split(":");
  let appId: string | null = pParts[0] || null;
  let pageId: string | null = pParts[1] || null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "WashERP-ApexBridge/1.0",
        Accept: "text/html,application/xhtml+xml,application/json",
      },
    });

    const html = await res.text();
    const latencyMs = Date.now() - startedAt;

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const apexVerMatch = html.match(/\/apex\/(\d+\.\d+\.\d+)\//i);
    const workspaceMatch = html.match(/r\/([a-zA-Z0-9_-]+)\/(\d+)\/files\//i);
    const flowIdMatch = html.match(/name="p_flow_id"\s+value="([^"]+)"/i);
    const stepIdMatch = html.match(/name="p_flow_step_id"\s+value="([^"]+)"/i);

    if (!appId && flowIdMatch) appId = flowIdMatch[1];
    if (!pageId && stepIdMatch) pageId = stepIdMatch[1];

    const xFrameOptions = res.headers.get("x-frame-options");
    const serverHeader = res.headers.get("server");

    return {
      reachable: res.ok || res.status < 500,
      url: targetUrl,
      statusCode: res.status,
      statusText: res.statusText || "OK",
      latencyMs,
      title: titleMatch ? titleMatch[1].trim() : null,
      serverHeader,
      apexVersion: apexVerMatch ? apexVerMatch[1] : null,
      appId,
      pageId,
      workspace: workspaceMatch ? workspaceMatch[1] : null,
      xFrameOptions,
      iframeBlocked: Boolean(xFrameOptions && /deny|sameorigin/i.test(xFrameOptions)),
      checkedAt,
    };
  } catch (err: any) {
    return {
      reachable: false,
      url: targetUrl,
      statusCode: null,
      statusText: "Unreachable",
      latencyMs: Date.now() - startedAt,
      title: null,
      serverHeader: null,
      apexVersion: null,
      appId,
      pageId,
      workspace: null,
      xFrameOptions: null,
      iframeBlocked: true,
      checkedAt,
      error: err?.name === "AbortError" ? "Connection timed out after 10s" : String(err?.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOracleOrdsData(params: {
  ordsUrl: string;
  authHeader?: string;
}): Promise<{ items: Record<string, any>[]; count: number; rawKeys: string[] }> {
  const parsed = assertSafeHttpUrl(params.ordsUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (params.authHeader && params.authHeader.trim()) {
      headers.Authorization = params.authHeader.trim();
    }

    const res = await fetch(parsed.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`ORDS HTTP ${res.status}: ${res.statusText}`);
    }

    const payload = await res.json();
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
      ? payload.data
      : [payload];

    return {
      items: items.slice(0, 200),
      count: items.length,
      rawKeys: items[0] && typeof items[0] === "object" ? Object.keys(items[0]) : [],
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 4. Hands-On Open-Source ERP Payload Translator (Odoo / ERPNext / Dolibarr)
// ============================================================================

export type OpenErpPlatform = "odoo" | "erpnext" | "dolibarr";
export type SandboxWorkflowAction = "create_buyer" | "create_work_order" | "create_chemical_po";

export function buildRealWorldErpPayload(
  platform: OpenErpPlatform,
  action: SandboxWorkflowAction,
  input: {
    buyerName: string;
    fileNo: string;
    styleNo: string;
    qty: number;
    washType: string;
    chemicalName: string;
    chemicalKg: number;
  }
): {
  protocol: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, any>;
  targetCollection: string;
  localDoc: Record<string, any>;
} {
  const now = new Date().toISOString();
  const safeId = `lab_${platform}_${Date.now()}`;

  if (action === "create_buyer") {
    const localDoc = {
      id: safeId,
      customer_name: input.buyerName,
      name: input.buyerName,
      title: `${input.buyerName} (${platform.toUpperCase()} Lab)`,
      status: "Qualified",
      source_erp: platform,
      created_at: now,
    };

    if (platform === "odoo") {
      return {
        protocol: "JSON-RPC 2.0",
        endpoint: "POST /jsonrpc",
        method: "object.execute_kw -> res.partner.create",
        headers: { "Content-Type": "application/json" },
        body: {
          jsonrpc: "2.0",
          method: "call",
          params: {
            service: "object",
            method: "execute_kw",
            args: [
              "rmg_wash_erp",
              2,
              "<API_KEY>",
              "res.partner",
              "create",
              [{ name: input.buyerName, is_company: true, customer_rank: 1 }],
            ],
          },
        },
        targetCollection: "erp_crm_leads",
        localDoc,
      };
    }

    if (platform === "erpnext") {
      return {
        protocol: "Frappe REST API",
        endpoint: "POST /api/resource/Customer",
        method: "POST DocType Customer",
        headers: {
          Authorization: "token <API_KEY>:<API_SECRET>",
          "Content-Type": "application/json",
        },
        body: {
          doctype: "Customer",
          customer_name: input.buyerName,
          customer_type: "Company",
          customer_group: "Commercial",
          territory: "All Territories",
        },
        targetCollection: "erp_crm_leads",
        localDoc,
      };
    }

    return {
      protocol: "Dolibarr REST API",
      endpoint: "POST /api/index.php/thirdparties",
      method: "POST Thirdparty (Client)",
      headers: {
        DOLAPIKEY: "<DOLAPIKEY>",
        "Content-Type": "application/json",
      },
      body: {
        name: input.buyerName,
        client: "1",
        code_client: "-1",
        note_private: "Created via Hands-On Lab",
      },
      targetCollection: "erp_crm_leads",
      localDoc,
    };
  }

  if (action === "create_work_order") {
    const localDoc = {
      id: safeId,
      name: `${input.fileNo} - ${input.washType}`,
      bom_name: `${input.styleNo} (${input.washType})`,
      buyer: input.buyerName,
      file_no: input.fileNo,
      qty_to_produce: input.qty,
      status: "In Progress",
      source_erp: platform,
      created_at: now,
    };

    if (platform === "odoo") {
      return {
        protocol: "JSON-RPC 2.0",
        endpoint: "POST /jsonrpc",
        method: "object.execute_kw -> mrp.production.create",
        headers: { "Content-Type": "application/json" },
        body: {
          jsonrpc: "2.0",
          method: "call",
          params: {
            service: "object",
            method: "execute_kw",
            args: [
              "rmg_wash_erp",
              2,
              "<API_KEY>",
              "mrp.production",
              "create",
              [
                {
                  origin: input.fileNo,
                  product_qty: input.qty,
                  note: `${input.buyerName} | ${input.styleNo} | ${input.washType}`,
                },
              ],
            ],
          },
        },
        targetCollection: "erp_work_orders",
        localDoc,
      };
    }

    if (platform === "erpnext") {
      return {
        protocol: "Frappe REST API",
        endpoint: "POST /api/resource/Work%20Order",
        method: "POST DocType Work Order",
        headers: {
          Authorization: "token <API_KEY>:<API_SECRET>",
          "Content-Type": "application/json",
        },
        body: {
          doctype: "Work Order",
          production_item: `${input.styleNo}-${input.washType}`,
          qty: input.qty,
          sales_order: input.fileNo,
          description: `Buyer: ${input.buyerName} | Wash: ${input.washType}`,
        },
        targetCollection: "erp_work_orders",
        localDoc,
      };
    }

    return {
      protocol: "Dolibarr REST API",
      endpoint: "POST /api/index.php/mos",
      method: "POST Manufacturing Order (MRP)",
      headers: {
        DOLAPIKEY: "<DOLAPIKEY>",
        "Content-Type": "application/json",
      },
      body: {
        ref: input.fileNo,
        label: `${input.buyerName} - ${input.styleNo} (${input.washType})`,
        mrptype: 0,
        qty: input.qty,
        status: 1,
      },
      targetCollection: "erp_work_orders",
      localDoc,
    };
  }

  // create_chemical_po
  const localDoc = {
    id: safeId,
    title: `PO: ${input.chemicalName} (${input.chemicalKg} kg)`,
    supplier: "Industrial Chemical Supplier",
    item_name: input.chemicalName,
    qty: input.chemicalKg,
    unit: "kg",
    status: "Ordered",
    source_erp: platform,
    created_at: now,
  };

  if (platform === "odoo") {
    return {
      protocol: "JSON-RPC 2.0",
      endpoint: "POST /jsonrpc",
      method: "object.execute_kw -> purchase.order.create",
      headers: { "Content-Type": "application/json" },
      body: {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            "rmg_wash_erp",
            2,
            "<API_KEY>",
            "purchase.order",
            "create",
            [
              {
                partner_ref: input.fileNo,
                notes: `${input.chemicalName} - ${input.chemicalKg} kg for ${input.washType}`,
              },
            ],
          ],
        },
      },
      targetCollection: "erp_rfqs",
      localDoc,
    };
  }

  if (platform === "erpnext") {
    return {
      protocol: "Frappe REST API",
      endpoint: "POST /api/resource/Purchase%20Order",
      method: "POST DocType Purchase Order",
      headers: {
        Authorization: "token <API_KEY>:<API_SECRET>",
        "Content-Type": "application/json",
      },
      body: {
        doctype: "Purchase Order",
        supplier: "Industrial Chemical Supplier",
        items: [
          {
            item_code: input.chemicalName,
            qty: input.chemicalKg,
            uom: "Kg",
          },
        ],
      },
      targetCollection: "erp_rfqs",
      localDoc,
    };
  }

  return {
    protocol: "Dolibarr REST API",
    endpoint: "POST /api/index.php/supplierorders",
    method: "POST Supplier Order",
    headers: {
      DOLAPIKEY: "<DOLAPIKEY>",
      "Content-Type": "application/json",
    },
    body: {
      ref_supplier: input.fileNo,
      note_public: `${input.chemicalName} (${input.chemicalKg} kg) — ${input.washType}`,
      lines: [
        {
          desc: input.chemicalName,
          qty: input.chemicalKg,
          product_type: 0,
        },
      ],
    },
    targetCollection: "erp_rfqs",
    localDoc,
  };
}

// ============================================================================
// 5. Self-Hosted Open-Source ERP Docker Compose Templates (Hands-On Local Lab)
// ============================================================================

export function generateOpenSourceErpCompose(stack: "odoo" | "erpnext" | "dolibarr" | "oracle-free" | "all"): string {
  if (stack === "oracle-free") {
    return `# Oracle AI Database Free (Official Oracle Container Registry)
# Registry: https://container-registry.oracle.com (database/free)
# Free License Limits: Up to 2 CPUs, 2 GB RAM, 12 GB Storage
# Run: docker compose -f docker-compose.oracle-free.yml up -d
# Connect from ERP Hub -> Oracle FreeSQL:
#   User: SYSTEM   |   Connect String: localhost:1521/FREEPDB1
services:
  oracle-free:
    image: container-registry.oracle.com/database/free:latest
    container_name: wash-erp-oracle-free
    ports:
      - "1521:1521"
    environment:
      - ORACLE_PWD=WashErpFree2026!
      - ORACLE_CHARACTERSET=AL32UTF8
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
    volumes:
      - oracle-free-data:/opt/oracle/oradata
    restart: unless-stopped

volumes:
  oracle-free-data:
`;
  }

  if (stack === "odoo") {
    return `# Odoo 18 Community Edition - Hands-On Local Stack
# Run: docker compose -f docker-compose.odoo.yml up -d
# Open: http://localhost:8069
services:
  odoo-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=postgres
      - POSTGRES_USER=odoo
      - POSTGRES_PASSWORD=odoo_dev_pass
    volumes:
      - odoo-pg-data:/var/lib/postgresql/data
    restart: unless-stopped

  odoo:
    image: odoo:18.0
    depends_on:
      - odoo-db
    ports:
      - "8069:8069"
    environment:
      - HOST=odoo-db
      - USER=odoo
      - PASSWORD=odoo_dev_pass
    volumes:
      - odoo-web-data:/var/lib/odoo
    restart: unless-stopped

volumes:
  odoo-pg-data:
  odoo-web-data:
`;
  }

  if (stack === "erpnext") {
    return `# ERPNext v15 (Frappe) - Quick Hands-On Single-Node Stack
# Run: docker compose -f docker-compose.erpnext.yml up -d
# Open: http://localhost:8080 (Default login: Administrator / admin)
services:
  mariadb:
    image: mariadb:10.6
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --skip-character-set-client-handshake
    environment:
      - MYSQL_ROOT_PASSWORD=admin
    volumes:
      - erpnext-db:/var/lib/mysql
    restart: unless-stopped

  redis-cache:
    image: redis:7-alpine
    restart: unless-stopped

  erpnext:
    image: frappe/erpnext:v15
    depends_on:
      - mariadb
      - redis-cache
    ports:
      - "8080:8000"
    environment:
      - FRAPPE_SITE_NAME_HEADER=frontend
    volumes:
      - erpnext-sites:/home/frappe/frappe-bench/sites
    restart: unless-stopped

volumes:
  erpnext-db:
  erpnext-sites:
`;
  }

  if (stack === "dolibarr") {
    return `# Dolibarr ERP & CRM 20 - Hands-On Local Stack
# Run: docker compose -f docker-compose.dolibarr.yml up -d
# Open: http://localhost:8090 (Default login: admin / admin123)
services:
  dolibarr-db:
    image: mariadb:10.11
    environment:
      - MYSQL_ROOT_PASSWORD=doli_root_pass
      - MYSQL_DATABASE=dolibarr
      - MYSQL_USER=dolibarr
      - MYSQL_PASSWORD=doli_pass
    volumes:
      - dolibarr-db:/var/lib/mysql
    restart: unless-stopped

  dolibarr:
    image: dolibarr/dolibarr:20
    depends_on:
      - dolibarr-db
    ports:
      - "8090:80"
    environment:
      - DOLI_DB_HOST=dolibarr-db
      - DOLI_DB_NAME=dolibarr
      - DOLI_DB_USER=dolibarr
      - DOLI_DB_PASSWORD=doli_pass
      - DOLI_ADMIN_LOGIN=admin
      - DOLI_ADMIN_PASSWORD=admin123
      - DOLI_MODULES=modSociete,modProduct,modCommande,modFournisseur,modMrp,modApi
    volumes:
      - dolibarr-docs:/var/www/documents
    restart: unless-stopped

volumes:
  dolibarr-db:
  dolibarr-docs:
`;
  }

  return `# Unified Open-Source ERP Practice Lab (Odoo 18 + Dolibarr 20)
# Odoo 18:    http://localhost:8069
# Dolibarr 20: http://localhost:8090 (admin / admin123)
services:
  odoo-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=postgres
      - POSTGRES_USER=odoo
      - POSTGRES_PASSWORD=odoo_dev_pass
    volumes:
      - odoo-pg-data:/var/lib/postgresql/data
    restart: unless-stopped

  odoo:
    image: odoo:18.0
    depends_on:
      - odoo-db
    ports:
      - "8069:8069"
    environment:
      - HOST=odoo-db
      - USER=odoo
      - PASSWORD=odoo_dev_pass
    volumes:
      - odoo-web-data:/var/lib/odoo
    restart: unless-stopped

  dolibarr-db:
    image: mariadb:10.11
    environment:
      - MYSQL_ROOT_PASSWORD=doli_root_pass
      - MYSQL_DATABASE=dolibarr
      - MYSQL_USER=dolibarr
      - MYSQL_PASSWORD=doli_pass
    volumes:
      - dolibarr-db:/var/lib/mysql
    restart: unless-stopped

  dolibarr:
    image: dolibarr/dolibarr:20
    depends_on:
      - dolibarr-db
    ports:
      - "8090:80"
    environment:
      - DOLI_DB_HOST=dolibarr-db
      - DOLI_DB_NAME=dolibarr
      - DOLI_DB_USER=dolibarr
      - DOLI_DB_PASSWORD=doli_pass
      - DOLI_ADMIN_LOGIN=admin
      - DOLI_ADMIN_PASSWORD=admin123
      - DOLI_MODULES=modSociete,modProduct,modCommande,modFournisseur,modMrp,modApi
    volumes:
      - dolibarr-docs:/var/www/documents
    restart: unless-stopped

volumes:
  odoo-pg-data:
  odoo-web-data:
  dolibarr-db:
  dolibarr-docs:
`;
}
