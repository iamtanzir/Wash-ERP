import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parquetWriteBuffer, type BasicType, type ColumnSource, type ParquetWriteOptions } from "hyparquet-writer";
import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects, type AsyncBuffer, type CompressionCodec } from "hyparquet";
import { compressors as readCompressors } from "hyparquet-compressors";

export type ParquetCodec = "SNAPPY" | "GZIP" | "UNCOMPRESSED";

const writerCompressors: ParquetWriteOptions["compressors"] = {
  GZIP: (input: Uint8Array) => new Uint8Array(zlib.gzipSync(input, { level: 9 })),
};

const JSON_OBJECT_FIELDS = new Set(["custom_values", "counts", "record_counts", "metadata", "recipes", "steps", "items"]);

function inferColumnTypeAndValues(
  key: string,
  rows: Record<string, any>[]
): { column: ColumnSource; isJsonField: boolean } {
  const rawValues = rows.map((r) => (r && key in r ? r[key] : null));
  const nonNull = rawValues.filter((v) => v !== null && v !== undefined);

  if (nonNull.length === 0) {
    return {
      column: {
        name: key,
        data: rawValues.map(() => null),
        type: "STRING",
        nullable: true,
      },
      isJsonField: false,
    };
  }

  const allBooleans = nonNull.every((v) => typeof v === "boolean");
  if (allBooleans) {
    return {
      column: {
        name: key,
        data: rawValues.map((v) => (v === null || v === undefined ? null : Boolean(v))),
        type: "BOOLEAN",
        nullable: true,
      },
      isJsonField: false,
    };
  }

  const allNumbers = nonNull.every((v) => typeof v === "number" && Number.isFinite(v));
  if (allNumbers) {
    const allInt32 = nonNull.every(
      (v) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647
    );
    const type: BasicType = allInt32 ? "INT32" : "DOUBLE";
    return {
      column: {
        name: key,
        data: rawValues.map((v) => (v === null || v === undefined ? null : Number(v))),
        type,
        nullable: true,
      },
      isJsonField: false,
    };
  }

  const hasObjects = nonNull.some((v) => typeof v === "object");
  return {
    column: {
      name: key,
      data: rawValues.map((v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      }),
      type: "STRING",
      nullable: true,
    },
    isJsonField: hasObjects || JSON_OBJECT_FIELDS.has(key),
  };
}

export function buildParquetBuffer(
  rows: Record<string, any>[],
  options?: { codec?: ParquetCodec; tableName?: string }
): Buffer {
  const codec: CompressionCodec = options?.codec || "SNAPPY";

  // Collect ordered unique column keys across all rows
  const keySet = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === "object") {
      for (const k of Object.keys(row)) {
        keySet.add(k);
      }
    }
  }

  if (keySet.size === 0) {
    keySet.add("id");
  }

  const columns: ColumnSource[] = [];
  const jsonFields: string[] = [];

  for (const key of keySet) {
    const { column, isJsonField } = inferColumnTypeAndValues(key, rows);
    columns.push(column);
    if (isJsonField) jsonFields.push(key);
  }

  const arrayBuffer = parquetWriteBuffer({
    columnData: columns,
    codec,
    compressors: codec === "GZIP" ? writerCompressors : undefined,
    statistics: true,
    createdBy: "Industrial Garment ERP Parquet Engine",
    kvMetadata: [
      { key: "erp_table", value: options?.tableName || "erp_collection" },
      { key: "json_fields", value: JSON.stringify(jsonFields) },
      { key: "exported_at", value: new Date().toISOString() },
    ],
  });

  return Buffer.from(arrayBuffer);
}

export async function writeParquetFileAtomic(
  filePath: string,
  rows: Record<string, any>[],
  options?: { codec?: ParquetCodec; tableName?: string }
): Promise<number> {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const buffer = buildParquetBuffer(rows, options);
  const tmpPath = `${resolved}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, resolved);
  return buffer.byteLength;
}

export function asyncBufferFromNodeBuffer(buf: Buffer): AsyncBuffer {
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end?: number) => arrayBuffer.slice(start, end),
  };
}

function hydrateRowTypes(rows: Record<string, any>[], jsonFieldNames: Set<string>): Record<string, any>[] {
  return rows.map((row) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined) continue;
      if (typeof v === "bigint") {
        clean[k] = Number(v);
      } else if (
        typeof v === "string" &&
        (jsonFieldNames.has(k) || JSON_OBJECT_FIELDS.has(k)) &&
        (v.startsWith("{") || v.startsWith("["))
      ) {
        try {
          clean[k] = JSON.parse(v);
        } catch {
          clean[k] = v;
        }
      } else {
        clean[k] = v;
      }
    }
    return clean;
  });
}

export async function readParquetAsyncBuffer(
  file: AsyncBuffer,
  columns?: string[]
): Promise<{ rows: Record<string, any>[]; columnCount: number; rowCount: number; readTimeMs: number }> {
  const t0 = performance.now();
  const metadata = await parquetMetadataAsync(file);

  let jsonFields = new Set<string>();
  const kvMeta = metadata.key_value_metadata || [];
  const jfEntry = kvMeta.find((kv) => kv.key === "json_fields");
  if (jfEntry?.value) {
    try {
      const parsed = JSON.parse(jfEntry.value);
      if (Array.isArray(parsed)) {
        jsonFields = new Set(parsed);
      }
    } catch {}
  }

  const rawRows = await parquetReadObjects({
    file,
    metadata,
    columns,
    compressors: readCompressors,
  });

  const rows = hydrateRowTypes(rawRows as Record<string, any>[], jsonFields);
  const readTimeMs = Math.max(0.01, Number((performance.now() - t0).toFixed(2)));
  const columnCount = Math.max(0, (metadata.schema?.length || 1) - 1);

  return {
    rows,
    columnCount,
    rowCount: Number(metadata.num_rows || rows.length),
    readTimeMs,
  };
}

export async function readParquetFile(
  filePath: string,
  columns?: string[]
): Promise<{ rows: Record<string, any>[]; columnCount: number; rowCount: number; readTimeMs: number }> {
  const file = await asyncBufferFromFile(path.resolve(filePath));
  return readParquetAsyncBuffer(file, columns);
}

export async function readParquetBuffer(
  buffer: Buffer,
  columns?: string[]
): Promise<{ rows: Record<string, any>[]; columnCount: number; rowCount: number; readTimeMs: number }> {
  const file = asyncBufferFromNodeBuffer(buffer);
  return readParquetAsyncBuffer(file, columns);
}

export function serializeRowsToCsv(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return "";
  const keySet = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === "object") {
      Object.keys(row).forEach((k) => keySet.add(k));
    }
  }
  const headers = Array.from(keySet);
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row?.[h])).join(","));
  }
  return lines.join("\n");
}

export interface ParquetComparisonStats {
  table: string;
  rowCount: number;
  columnCount: number;
  csvBytes: number;
  jsonBytes: number;
  parquetSnappyBytes: number;
  parquetGzipBytes: number;
  compressionRatioVsCsv: number;
  compressionRatioVsJson: number;
  spaceSavedVsCsvPercent: number;
  spaceSavedVsJsonPercent: number;
  parquetReadMs: number;
  csvParseMs: number;
  speedupFactor: number;
}

export async function benchmarkParquetVsCsv(
  table: string,
  rows: Record<string, any>[]
): Promise<ParquetComparisonStats> {
  const csvStr = serializeRowsToCsv(rows);
  const jsonStr = JSON.stringify(rows);
  const csvBytes = Buffer.byteLength(csvStr, "utf-8");
  const jsonBytes = Buffer.byteLength(jsonStr, "utf-8");

  const snappyBuf = buildParquetBuffer(rows, { codec: "SNAPPY", tableName: table });
  const gzipBuf = buildParquetBuffer(rows, { codec: "GZIP", tableName: table });

  // Measure Parquet columnar single-projection / read time vs CSV line-splitting parse
  const tCsv0 = performance.now();
  const lines = csvStr.split("\n");
  for (let i = 1; i < lines.length; i++) {
    lines[i].split(",");
  }
  const csvParseMs = Math.max(0.05, Number((performance.now() - tCsv0).toFixed(2)));

  const readRes = await readParquetBuffer(snappyBuf);
  const parquetReadMs = readRes.readTimeMs;

  const bestParquetBytes = Math.min(snappyBuf.byteLength, gzipBuf.byteLength);
  const compressionRatioVsCsv =
    csvBytes > 0 && bestParquetBytes > 0 ? Number((csvBytes / bestParquetBytes).toFixed(2)) : 1;
  const compressionRatioVsJson =
    jsonBytes > 0 && bestParquetBytes > 0 ? Number((jsonBytes / bestParquetBytes).toFixed(2)) : 1;

  const spaceSavedVsCsvPercent =
    csvBytes > 0 ? Number(Math.max(0, ((csvBytes - bestParquetBytes) / csvBytes) * 100).toFixed(1)) : 0;
  const spaceSavedVsJsonPercent =
    jsonBytes > 0 ? Number(Math.max(0, ((jsonBytes - bestParquetBytes) / jsonBytes) * 100).toFixed(1)) : 0;

  const speedupFactor =
    parquetReadMs > 0 ? Number(Math.max(1, csvParseMs / parquetReadMs).toFixed(1)) : 1;

  return {
    table,
    rowCount: rows.length,
    columnCount: readRes.columnCount,
    csvBytes,
    jsonBytes,
    parquetSnappyBytes: snappyBuf.byteLength,
    parquetGzipBytes: gzipBuf.byteLength,
    compressionRatioVsCsv,
    compressionRatioVsJson,
    spaceSavedVsCsvPercent,
    spaceSavedVsJsonPercent,
    parquetReadMs,
    csvParseMs,
    speedupFactor,
  };
}
