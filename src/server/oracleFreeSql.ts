import oracledb from "oracledb";

// Configure pure-JS Thin Mode safe defaults (no Oracle Instant Client needed)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

export interface OracleFreeSqlConfig {
  user: string;
  password: string;
  connectString: string;
  walletPassword?: string;
}

export interface OracleFreeSqlTestResult {
  connected: boolean;
  schemaUser: string;
  databaseVersion: string;
  latencyMs: number;
  tableCount: number;
  tables: { tableName: string; numRows: number | null }[];
  checkedAt: string;
}

export interface OracleSqlExecResult {
  columns: string[];
  rows: Record<string, any>[];
  rowsAffected: number;
  dbmsOutput: string[];
  executionMs: number;
  statementKind: "QUERY" | "PLSQL" | "DML_DDL";
}

function assertConfig(cfg: OracleFreeSqlConfig) {
  if (!cfg.user?.trim() || !cfg.password || !cfg.connectString?.trim()) {
    throw new Error("Oracle FreeSQL Schema User, Password, and SQL*Net Connect String are required.");
  }
}

async function openOracleConnection(cfg: OracleFreeSqlConfig) {
  assertConfig(cfg);
  return oracledb.getConnection({
    user: cfg.user.trim(),
    password: cfg.password,
    connectString: cfg.connectString.trim(),
    ...(cfg.walletPassword ? { walletPassword: cfg.walletPassword } : {}),
    connectTimeout: 10,
  });
}

function sanitizeSqlStatement(rawSql: string): { sql: string; isPlsql: boolean } {
  let cleaned = String(rawSql || "").trim();
  if (!cleaned) {
    throw new Error("SQL statement cannot be empty.");
  }
  const upper = cleaned.toUpperCase();
  const isPlsql =
    upper.startsWith("BEGIN") ||
    upper.startsWith("DECLARE") ||
    upper.startsWith("CREATE OR REPLACE PROCEDURE") ||
    upper.startsWith("CREATE OR REPLACE FUNCTION") ||
    upper.startsWith("CREATE OR REPLACE TRIGGER") ||
    upper.startsWith("CREATE PROCEDURE") ||
    upper.startsWith("CREATE FUNCTION");

  if (isPlsql) {
    // Strip trailing '/' used in SQL*Plus / FreeSQL scripts, keep ending ';' inside PL/SQL block
    cleaned = cleaned.replace(/\n\s*\/\s*$/, "").trim();
  } else {
    // Standard SQL SELECT/INSERT/UPDATE/DELETE/DDL must NOT end with a semicolon in oracledb
    cleaned = cleaned.replace(/[;\s]+$/, "").trim();
  }
  return { sql: cleaned, isPlsql };
}

export async function testOracleFreeSqlConnection(
  cfg: OracleFreeSqlConfig
): Promise<OracleFreeSqlTestResult> {
  const started = Date.now();
  let conn: oracledb.Connection | null = null;
  try {
    conn = await openOracleConnection(cfg);

    let databaseVersion = "Oracle Database Free (Thin Mode)";
    try {
      const verRes = await conn.execute<{ BANNER_FULL?: string; BANNER?: string }>(
        `SELECT BANNER_FULL FROM V$VERSION FETCH FIRST 1 ROWS ONLY`
      );
      const firstRow = verRes.rows?.[0];
      if (firstRow?.BANNER_FULL || firstRow?.BANNER) {
        databaseVersion = String(firstRow.BANNER_FULL || firstRow.BANNER);
      }
    } catch {
      try {
        const compRes = await conn.execute<{ PRODUCT?: string; VERSION_FULL?: string; VERSION?: string }>(
          `SELECT PRODUCT, VERSION_FULL FROM PRODUCT_COMPONENT_VERSION FETCH FIRST 1 ROWS ONLY`
        );
        const r = compRes.rows?.[0];
        if (r) {
          databaseVersion = `${r.PRODUCT || "Oracle DB"} ${r.VERSION_FULL || r.VERSION || ""}`.trim();
        }
      } catch {
        // Ignore version view permissions if locked down
      }
    }

    const userRes = await conn.execute<{ CURRENT_USER: string }>(
      `SELECT USER AS CURRENT_USER FROM DUAL`
    );
    const schemaUser = String(userRes.rows?.[0]?.CURRENT_USER || cfg.user.trim()).toUpperCase();

    const tablesRes = await conn.execute<{ TABLE_NAME: string; NUM_ROWS: number | null }>(
      `SELECT TABLE_NAME, NUM_ROWS FROM USER_TABLES ORDER BY TABLE_NAME FETCH FIRST 100 ROWS ONLY`
    );
    const tables = (tablesRes.rows || []).map((r) => ({
      tableName: String(r.TABLE_NAME),
      numRows: r.NUM_ROWS === null || r.NUM_ROWS === undefined ? null : Number(r.NUM_ROWS),
    }));

    return {
      connected: true,
      schemaUser,
      databaseVersion,
      latencyMs: Date.now() - started,
      tableCount: tables.length,
      tables,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    if (conn) {
      await conn.close().catch(() => {});
    }
  }
}

export async function executeOracleSql(
  cfg: OracleFreeSqlConfig,
  rawSql: string,
  maxRows = 200
): Promise<OracleSqlExecResult> {
  const started = Date.now();
  const { sql, isPlsql } = sanitizeSqlStatement(rawSql);
  let conn: oracledb.Connection | null = null;
  const dbmsOutput: string[] = [];

  try {
    conn = await openOracleConnection(cfg);

    if (isPlsql) {
      await conn.execute(`BEGIN DBMS_OUTPUT.ENABLE(NULL); END;`).catch(() => {});
    }

    const res = await conn.execute<Record<string, any>>(sql, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows,
      autoCommit: true,
    });

    if (isPlsql) {
      for (let i = 0; i < 100; i++) {
        const lineRes = await conn
          .execute<{ line: string | null; status: number }>(
            `BEGIN DBMS_OUTPUT.GET_LINE(:line, :status); END;`,
            {
              line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
              status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            }
          )
          .catch(() => null);
        const out = lineRes?.outBinds as { line?: string | null; status?: number } | undefined;
        if (!out || out.status !== 0) break;
        if (out.line !== undefined && out.line !== null) {
          dbmsOutput.push(String(out.line));
        }
      }
    }

    const columns = Array.isArray(res.metaData) ? res.metaData.map((m) => m.name) : [];
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const statementKind = isPlsql ? "PLSQL" : columns.length > 0 ? "QUERY" : "DML_DDL";

    return {
      columns,
      rows,
      rowsAffected: Number(res.rowsAffected) || 0,
      dbmsOutput,
      executionMs: Date.now() - started,
      statementKind,
    };
  } finally {
    if (conn) {
      await conn.close().catch(() => {});
    }
  }
}

export async function provisionWashErpSchema(cfg: OracleFreeSqlConfig): Promise<{
  created: string[];
  existing: string[];
  latencyMs: number;
}> {
  const started = Date.now();
  const created: string[] = [];
  const existing: string[] = [];
  let conn: oracledb.Connection | null = null;

  const ddls: { name: string; sql: string }[] = [
    {
      name: "WASH_ERP_ORDERS",
      sql: `CREATE TABLE WASH_ERP_ORDERS (
        ORDER_ID VARCHAR2(80) PRIMARY KEY,
        BUYER VARCHAR2(120),
        FILE_NO VARCHAR2(80),
        STYLE_NO VARCHAR2(80),
        COLOR VARCHAR2(80),
        ORDER_QTY NUMBER(12) DEFAULT 0,
        WASH_TYPE VARCHAR2(100),
        TOD VARCHAR2(40),
        UPDATED_AT VARCHAR2(50)
      )`,
    },
    {
      name: "WASH_ERP_REJECTIONS",
      sql: `CREATE TABLE WASH_ERP_REJECTIONS (
        REJ_ID VARCHAR2(80) PRIMARY KEY,
        BUYER VARCHAR2(120),
        ERP_NO VARCHAR2(80),
        COLOUR VARCHAR2(80),
        R_DATE VARCHAR2(30),
        BEFORE_QTY NUMBER(10) DEFAULT 0,
        AFTER_QTY NUMBER(10) DEFAULT 0,
        TTL_QTY NUMBER(10) DEFAULT 0,
        REJECTION_TYPE VARCHAR2(60),
        DEFECT_REMARKS VARCHAR2(200)
      )`,
    },
    {
      name: "WASH_ERP_LOADS",
      sql: `CREATE TABLE WASH_ERP_LOADS (
        LOAD_ID VARCHAR2(80) PRIMARY KEY,
        LOAD_NO VARCHAR2(80),
        MC_NUMBER VARCHAR2(60),
        SHIFT VARCHAR2(20),
        BUYER VARCHAR2(120),
        PCS_QTY NUMBER(10) DEFAULT 0,
        TOTAL_WEIGHT_KG NUMBER(12,2) DEFAULT 0,
        WET_PROCESS_TYPE VARCHAR2(100),
        STATUS VARCHAR2(40)
      )`,
    },
  ];

  try {
    conn = await openOracleConnection(cfg);
    for (const ddl of ddls) {
      try {
        await conn.execute(ddl.sql);
        created.push(ddl.name);
      } catch (err: any) {
        if (err?.errorNum === 955 || String(err?.message || "").includes("ORA-00955")) {
          existing.push(ddl.name);
        } else {
          throw err;
        }
      }
    }
    return { created, existing, latencyMs: Date.now() - started };
  } finally {
    if (conn) {
      await conn.close().catch(() => {});
    }
  }
}

export async function syncWashErpToOracleFreeSql(
  cfg: OracleFreeSqlConfig,
  payload: { orders: any[]; rejections: any[]; loads: any[] }
): Promise<{
  ordersSynced: number;
  rejectionsSynced: number;
  loadsSynced: number;
  latencyMs: number;
}> {
  const started = Date.now();
  await provisionWashErpSchema(cfg);

  let conn: oracledb.Connection | null = null;
  try {
    conn = await openOracleConnection(cfg);

    const orderBinds = (payload.orders || []).slice(0, 250).map((o) => ({
      ORDER_ID: String(o.id || o.file_no || Math.random()).slice(0, 80),
      BUYER: String(o.buyer || "Unknown").slice(0, 120),
      FILE_NO: String(o.file_no || "").slice(0, 80),
      STYLE_NO: String(o.style_no || "").slice(0, 80),
      COLOR: String(o.color || o.colour || "").slice(0, 80),
      ORDER_QTY: Number(o.order_qty) || 0,
      WASH_TYPE: String(o.wash_type || "Wash").slice(0, 100),
      TOD: String(o.tod || "").slice(0, 40),
      UPDATED_AT: String(o.updated_at || new Date().toISOString()).slice(0, 50),
    }));

    if (orderBinds.length > 0) {
      await conn.executeMany(
        `MERGE INTO WASH_ERP_ORDERS t
         USING (SELECT :ORDER_ID AS ORDER_ID, :BUYER AS BUYER, :FILE_NO AS FILE_NO, :STYLE_NO AS STYLE_NO,
                       :COLOR AS COLOR, :ORDER_QTY AS ORDER_QTY, :WASH_TYPE AS WASH_TYPE, :TOD AS TOD, :UPDATED_AT AS UPDATED_AT FROM DUAL) s
         ON (t.ORDER_ID = s.ORDER_ID)
         WHEN MATCHED THEN UPDATE SET t.BUYER = s.BUYER, t.FILE_NO = s.FILE_NO, t.STYLE_NO = s.STYLE_NO,
           t.COLOR = s.COLOR, t.ORDER_QTY = s.ORDER_QTY, t.WASH_TYPE = s.WASH_TYPE, t.TOD = s.TOD, t.UPDATED_AT = s.UPDATED_AT
         WHEN NOT MATCHED THEN INSERT (ORDER_ID, BUYER, FILE_NO, STYLE_NO, COLOR, ORDER_QTY, WASH_TYPE, TOD, UPDATED_AT)
           VALUES (s.ORDER_ID, s.BUYER, s.FILE_NO, s.STYLE_NO, s.COLOR, s.ORDER_QTY, s.WASH_TYPE, s.TOD, s.UPDATED_AT)`,
        orderBinds,
        { autoCommit: true }
      );
    }

    const rejBinds = (payload.rejections || []).slice(0, 250).map((r) => {
      const ttl = Number(r.ttl) || 0;
      const isAfter = /after/i.test(String(r.rejectionType || ""));
      return {
        REJ_ID: String(r.id || Math.random()).slice(0, 80),
        BUYER: String(r.buyer || "Unknown").slice(0, 120),
        ERP_NO: String(r.erpNo || "").slice(0, 80),
        COLOUR: String(r.colour || "").slice(0, 80),
        R_DATE: String(r.rDate || "").slice(0, 30),
        BEFORE_QTY: isAfter ? 0 : ttl,
        AFTER_QTY: isAfter ? ttl : 0,
        TTL_QTY: ttl,
        REJECTION_TYPE: String(r.rejectionType || "Before Wash Rejections").slice(0, 60),
        DEFECT_REMARKS: String(r.remarks || "").slice(0, 200),
      };
    });

    if (rejBinds.length > 0) {
      await conn.executeMany(
        `MERGE INTO WASH_ERP_REJECTIONS t
         USING (SELECT :REJ_ID AS REJ_ID, :BUYER AS BUYER, :ERP_NO AS ERP_NO, :COLOUR AS COLOUR, :R_DATE AS R_DATE,
                       :BEFORE_QTY AS BEFORE_QTY, :AFTER_QTY AS AFTER_QTY, :TTL_QTY AS TTL_QTY, :REJECTION_TYPE AS REJECTION_TYPE, :DEFECT_REMARKS AS DEFECT_REMARKS FROM DUAL) s
         ON (t.REJ_ID = s.REJ_ID)
         WHEN MATCHED THEN UPDATE SET t.BUYER = s.BUYER, t.ERP_NO = s.ERP_NO, t.COLOUR = s.COLOUR, t.R_DATE = s.R_DATE,
           t.BEFORE_QTY = s.BEFORE_QTY, t.AFTER_QTY = s.AFTER_QTY, t.TTL_QTY = s.TTL_QTY, t.REJECTION_TYPE = s.REJECTION_TYPE, t.DEFECT_REMARKS = s.DEFECT_REMARKS
         WHEN NOT MATCHED THEN INSERT (REJ_ID, BUYER, ERP_NO, COLOUR, R_DATE, BEFORE_QTY, AFTER_QTY, TTL_QTY, REJECTION_TYPE, DEFECT_REMARKS)
           VALUES (s.REJ_ID, s.BUYER, s.ERP_NO, s.COLOUR, s.R_DATE, s.BEFORE_QTY, s.AFTER_QTY, s.TTL_QTY, s.REJECTION_TYPE, s.DEFECT_REMARKS)`,
        rejBinds,
        { autoCommit: true }
      );
    }

    const loadBinds = (payload.loads || []).slice(0, 250).map((l) => ({
      LOAD_ID: String(l.id || l.load_no || Math.random()).slice(0, 80),
      LOAD_NO: String(l.load_no || "").slice(0, 80),
      MC_NUMBER: String(l.mc_number || "").slice(0, 60),
      SHIFT: String(l.shift || "A").slice(0, 20),
      BUYER: String(l.buyer || "").slice(0, 120),
      PCS_QTY: Number(l.pcs_qty) || 0,
      TOTAL_WEIGHT_KG: Number(l.total_weight_kg) || 0,
      WET_PROCESS_TYPE: String(l.wet_process_type || "").slice(0, 100),
      STATUS: String(l.status || "Planned").slice(0, 40),
    }));

    if (loadBinds.length > 0) {
      await conn.executeMany(
        `MERGE INTO WASH_ERP_LOADS t
         USING (SELECT :LOAD_ID AS LOAD_ID, :LOAD_NO AS LOAD_NO, :MC_NUMBER AS MC_NUMBER, :SHIFT AS SHIFT,
                       :BUYER AS BUYER, :PCS_QTY AS PCS_QTY, :TOTAL_WEIGHT_KG AS TOTAL_WEIGHT_KG, :WET_PROCESS_TYPE AS WET_PROCESS_TYPE, :STATUS AS STATUS FROM DUAL) s
         ON (t.LOAD_ID = s.LOAD_ID)
         WHEN MATCHED THEN UPDATE SET t.LOAD_NO = s.LOAD_NO, t.MC_NUMBER = s.MC_NUMBER, t.SHIFT = s.SHIFT,
           t.BUYER = s.BUYER, t.PCS_QTY = s.PCS_QTY, t.TOTAL_WEIGHT_KG = s.TOTAL_WEIGHT_KG, t.WET_PROCESS_TYPE = s.WET_PROCESS_TYPE, t.STATUS = s.STATUS
         WHEN NOT MATCHED THEN INSERT (LOAD_ID, LOAD_NO, MC_NUMBER, SHIFT, BUYER, PCS_QTY, TOTAL_WEIGHT_KG, WET_PROCESS_TYPE, STATUS)
           VALUES (s.LOAD_ID, s.LOAD_NO, s.MC_NUMBER, s.SHIFT, s.BUYER, s.PCS_QTY, s.TOTAL_WEIGHT_KG, s.WET_PROCESS_TYPE, s.STATUS)`,
        loadBinds,
        { autoCommit: true }
      );
    }

    return {
      ordersSynced: orderBinds.length,
      rejectionsSynced: rejBinds.length,
      loadsSynced: loadBinds.length,
      latencyMs: Date.now() - started,
    };
  } finally {
    if (conn) {
      await conn.close().catch(() => {});
    }
  }
}

export function convertQuickSqlToOracleDdl(quickSqlText: string): string {
  const lines = String(quickSqlText || "").split(/\r?\n/);
  const blocks: { table: string; cols: string[] }[] = [];
  let current: { table: string; cols: string[] } | null = null;

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#") || rawLine.trim().startsWith("--")) continue;
    const isIndented = /^\s+/.test(rawLine);
    const trimmed = rawLine.trim();

    if (!isIndented && !trimmed.includes("/")) {
      const tableName = trimmed.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
      current = { table: tableName, cols: [] };
      blocks.push(current);
      continue;
    }

    if (!current) {
      current = { table: "CUSTOM_WASH_TABLE", cols: [] };
      blocks.push(current);
    }

    // Parse QuickSQL tokens: "col_name vc100 nn", "qty num", "created d", "notes clob"
    const tokens = trimmed.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const colName = tokens[0].replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
    const attrs = tokens.slice(1).map((t) => t.toLowerCase());

    let oracleType = "VARCHAR2(200)";
    let nullable = "";
    for (const a of attrs) {
      const vcMatch = a.match(/^vc(\d+)$/);
      if (vcMatch) oracleType = `VARCHAR2(${vcMatch[1]})`;
      else if (a === "num" || a === "number" || a === "int") oracleType = "NUMBER";
      else if (a === "d" || a === "date") oracleType = "DATE";
      else if (a === "ts" || a === "timestamp") oracleType = "TIMESTAMP";
      else if (a === "clob" || a === "text") oracleType = "CLOB";
      else if (a === "json") oracleType = "JSON";
      else if (a === "nn" || a === "notnull") nullable = " NOT NULL";
    }

    current.cols.push(`  ${colName.padEnd(20)} ${oracleType}${nullable}`);
  }

  if (blocks.length === 0) {
    return "-- Enter QuickSQL table name on line 1 and indented columns below";
  }

  return blocks
    .map((b) => {
      const pkLine = `  ID                   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`;
      const allCols = [pkLine, ...b.cols].join(",\n");
      return `CREATE TABLE ${b.table} (\n${allCols}\n);`;
    })
    .join("\n\n");
}

export function executeLocalWashSqlQuery(
  rawSql: string,
  collections: {
    orders: any[];
    loads: any[];
    rejections: any[];
    dailyLogs: any[];
    archive: any[];
  }
): { headers: string[]; rows: any[][]; sourceLabel: string } {
  const clean = String(rawSql || "").trim();
  if (!clean) throw new Error("Please enter a SQL query.");
  const upper = clean.toUpperCase().replace(/\s+/g, " ");

  if (upper.includes("USER_TABLES") || upper.includes("SHOW TABLES")) {
    return {
      sourceLabel: "Live Wash ERP Metadata",
      headers: ["TABLE_NAME", "ROW_COUNT", "ENGINE"],
      rows: [
        ["WASH_ORDERS", collections.orders.length, "Live Wash ERP"],
        ["WASH_LOADS", collections.loads.length, "Live Wash ERP"],
        ["WASH_REJECTIONS", collections.rejections.length, "Live Wash ERP"],
        ["DAILY_LOGS", collections.dailyLogs.length, "Live Wash ERP"],
        ["BUYER_DATA_BANK", collections.archive.length, "Live Wash ERP"],
      ],
    };
  }

  const limitMatch = upper.match(/FETCH FIRST (\d+) ROWS|LIMIT (\d+)/);
  const limit = Math.min(200, Number(limitMatch?.[1] || limitMatch?.[2] || 50));

  if (upper.includes("WASH_LOAD")) {
    const data = collections.loads.slice(0, limit);
    return {
      sourceLabel: "Live Wash M/C Loads",
      headers: ["LOAD_NO", "MC_NUMBER", "SHIFT", "BUYER", "PCS_QTY", "TOTAL_KG", "PROCESS", "STATUS"],
      rows: data.map((l) => [
        l.load_no || l.id || "—",
        l.mc_number || "—",
        l.shift || "—",
        l.buyer || "—",
        Number(l.pcs_qty) || 0,
        Number(l.total_weight_kg) || 0,
        l.wet_process_type || "—",
        l.status || "Planned",
      ]),
    };
  }

  if (upper.includes("REJECTION")) {
    const data = collections.rejections.slice(0, limit);
    return {
      sourceLabel: "Live Wash Rejections",
      headers: ["BUYER", "ERP_NO", "COLOUR", "DATE", "TTL_QTY", "STAGE", "DEFECT_REMARKS"],
      rows: data.map((r) => [
        r.buyer || "—",
        r.erpNo || "—",
        r.colour || "—",
        r.rDate || "—",
        Number(r.ttl) || 0,
        r.rejectionType || "—",
        r.remarks || "—",
      ]),
    };
  }

  if (upper.includes("DAILY_LOG")) {
    const data = collections.dailyLogs.slice(0, limit);
    return {
      sourceLabel: "Live Daily Production Logs",
      headers: ["LOG_DATE", "ERP_ORDER", "RECEIVED_QTY", "DELIVERED_QTY", "UNIT", "CATEGORY"],
      rows: data.map((d) => [
        d.log_date || "—",
        d.erp_order || "—",
        Number(d.received_qty) || 0,
        Number(d.delivered_qty) || 0,
        d.unit || "—",
        d.category || "GMT",
      ]),
    };
  }

  if (upper.includes("BANK") || upper.includes("ARCHIVE")) {
    const data = collections.archive.slice(0, limit);
    return {
      sourceLabel: "Buyer Data Bank Archive",
      headers: ["BUYER", "FILE_NO", "STYLE_NO", "ORDER_QTY", "TOTAL_RECEIVED", "TOTAL_DELIVERED"],
      rows: data.map((a) => [
        a.buyer || "—",
        a.file_no || a.erp_order || "—",
        a.style_no || "—",
        Number(a.order_qty) || 0,
        Number(a.total_received) || 0,
        Number(a.total_delivered) || 0,
      ]),
    };
  }

  // Default: WASH_ORDERS / ERP_ORDERS (supports WHERE BUYER LIKE '...' filter)
  let filteredOrders = collections.orders;
  const buyerFilter = clean.match(/BUYER\s*(?:=|LIKE)\s*'([^']+)'/i);
  if (buyerFilter) {
    const needle = buyerFilter[1].replace(/%/g, "").trim().toLowerCase();
    filteredOrders = filteredOrders.filter((o) =>
      String(o.buyer || "").toLowerCase().includes(needle)
    );
  }
  const data = filteredOrders.slice(0, limit);
  return {
    sourceLabel: "Live Active Wash Orders",
    headers: ["FILE_NO", "BUYER", "STYLE_NO", "COLOR", "ORDER_QTY", "WASH_TYPE", "TOD"],
    rows: data.map((o) => [
      o.file_no || o.id || "—",
      o.buyer || "—",
      o.style_no || "—",
      o.color || o.colour || "—",
      Number(o.order_qty) || 0,
      o.wash_type || "Wash",
      o.tod || "—",
    ]),
  };
}
