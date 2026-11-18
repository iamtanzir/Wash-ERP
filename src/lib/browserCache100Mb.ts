/**
 * Inbuilt Browser Data Cache (up to 100 MB via IndexedDB) + 5-Year Local Recall Index
 * Stores live ERP orders, 5-year daily logs, Buyer Data Bank archives, 3-shift reports,
 * and past Support Q&A memories locally in browser storage with automatic 100 MB cap enforcement.
 */

export const MAX_BROWSER_CACHE_BYTES = 100 * 1024 * 1024; // 100 MB
const DB_NAME = 'inctl_support_cache_100mb';
const DB_VERSION = 1;
const STORE_NAME = 'cache_segments';

export interface BrowserCacheStats {
  usedBytes: number;
  usedMb: number;
  usedLabel: string;
  maxMb: number;
  usagePct: number;
  recordCount: number;
  lastSyncedAt: string | null;
  retentionWindowStart: string | null;
}

export function formatCacheUsage(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface CacheSegmentRecord {
  key: string;
  byteSize: number;
  updatedAt: number;
  syncedAt: string;
  retentionStart?: string;
  itemCount: number;
  payload: any;
}

function estimatePayloadBytes(data: any): number {
  try {
    const json = JSON.stringify(data);
    return typeof Blob !== 'undefined' ? new Blob([json]).size : json.length * 2;
  } catch {
    return 0;
  }
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readAllSegments(): Promise<CacheSegmentRecord[]> {
  const db = await openCacheDb();
  if (!db) return [];
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function get100MbCacheStats(): Promise<BrowserCacheStats> {
  const segments = await readAllSegments();
  const usedBytes = segments.reduce((s, seg) => s + (Number(seg.byteSize) || 0), 0);
  const recordCount = segments.reduce((s, seg) => s + (Number(seg.itemCount) || 0), 0);
  const sortedTimes = segments
    .map(s => s.syncedAt)
    .filter(Boolean)
    .sort()
    .reverse();
  const retentionWindowStart = segments.find(s => s.retentionStart)?.retentionStart || null;

  return {
    usedBytes,
    usedMb: Number((usedBytes / (1024 * 1024)).toFixed(2)),
    usedLabel: formatCacheUsage(usedBytes),
    maxMb: 100,
    usagePct: Number(Math.min(100, (usedBytes / MAX_BROWSER_CACHE_BYTES) * 100).toFixed(2)),
    recordCount,
    lastSyncedAt: sortedTimes[0] || null,
    retentionWindowStart
  };
}

export async function syncSnapshotTo100MbCache(snapshot: {
  syncedAt: string;
  retentionWindowStart?: string;
  orders?: any[];
  logs?: any[];
  archivedOrders?: any[];
  shiftReports?: any[];
  washRejections?: any[];
  skills?: any[];
  memories?: any[];
}): Promise<BrowserCacheStats> {
  const db = await openCacheDb();
  if (!db) return get100MbCacheStats();

  const buckets: { key: string; payload: any[] }[] = [
    { key: 'orders_active', payload: snapshot.orders || [] },
    { key: 'logs_5y', payload: snapshot.logs || [] },
    { key: 'archives_5y', payload: snapshot.archivedOrders || [] },
    { key: 'shifts_5y', payload: snapshot.shiftReports || [] },
    { key: 'rejections_5y', payload: snapshot.washRejections || [] },
    { key: 'skills_rules', payload: snapshot.skills || [] },
    { key: 'memories_5y', payload: snapshot.memories || [] }
  ];

  // Build segment records and enforce 100 MB ceiling
  const now = Date.now();
  const records: CacheSegmentRecord[] = [];
  let runningBytes = 0;

  for (const b of buckets) {
    let payload = b.payload;
    let byteSize = estimatePayloadBytes(payload);
    if (runningBytes + byteSize > MAX_BROWSER_CACHE_BYTES && Array.isArray(payload) && payload.length > 0) {
      // Trim oldest items from large log arrays if cache ever exceeds 100 MB
      const ratio = Math.max(0.1, (MAX_BROWSER_CACHE_BYTES - runningBytes) / Math.max(1, byteSize));
      const keepCount = Math.floor(payload.length * ratio);
      payload = payload.slice(-keepCount);
      byteSize = estimatePayloadBytes(payload);
    }
    runningBytes += byteSize;
    records.push({
      key: b.key,
      byteSize,
      updatedAt: now,
      syncedAt: snapshot.syncedAt || new Date().toISOString(),
      retentionStart: snapshot.retentionWindowStart,
      itemCount: Array.isArray(payload) ? payload.length : 0,
      payload
    });
  }

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  return get100MbCacheStats();
}

export async function appendMemoryTo100MbCache(entry: {
  query: string;
  summary: string;
  date: string;
}): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;

  const segments = await readAllSegments();
  const existing = segments.find(s => s.key === 'memories_5y');
  const totalOtherBytes = segments
    .filter(s => s.key !== 'memories_5y')
    .reduce((s, seg) => s + (seg.byteSize || 0), 0);

  const list: any[] = Array.isArray(existing?.payload) ? existing!.payload.slice() : [];
  list.push({
    id: `local-mem-${Date.now()}`,
    date: entry.date,
    query: entry.query.slice(0, 220),
    summary: entry.summary.slice(0, 320),
    createdAt: new Date().toISOString()
  });

  // Retain last 5 years & stay strictly below 100 MB budget
  const cutoffYr = new Date().getFullYear() - 5;
  const minDate = `${cutoffYr}-01-01`;
  let filtered = list.filter(m => !m.date || String(m.date) >= minDate);
  let bytes = estimatePayloadBytes(filtered);
  while (totalOtherBytes + bytes > MAX_BROWSER_CACHE_BYTES && filtered.length > 50) {
    filtered = filtered.slice(Math.ceil(filtered.length * 0.1));
    bytes = estimatePayloadBytes(filtered);
  }

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        key: 'memories_5y',
        byteSize: bytes,
        updatedAt: Date.now(),
        syncedAt: new Date().toISOString(),
        retentionStart: minDate,
        itemCount: filtered.length,
        payload: filtered
      } as CacheSegmentRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function search100MbBrowserCache(query: string): Promise<{
  cachedBytes: number;
  hits: { source: string; title: string; detail: string }[];
}> {
  const segments = await readAllSegments();
  const cachedBytes = segments.reduce((s, seg) => s + (seg.byteSize || 0), 0);
  if (segments.length === 0 || !query.trim()) {
    return { cachedBytes, hits: [] };
  }

  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  if (words.length === 0) return { cachedBytes, hits: [] };

  const hits: { source: string; title: string; detail: string; score: number }[] = [];

  const scan = (sourceName: string, items: any[], extract: (item: any) => { title: string; detail: string; text: string }) => {
    for (const item of items) {
      const { title, detail, text } = extract(item);
      const lower = text.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (lower.includes(w)) score += 10;
      }
      if (score > 0) {
        hits.push({ source: sourceName, title, detail, score });
      }
    }
  };

  for (const seg of segments) {
    const arr = Array.isArray(seg.payload) ? seg.payload : [];
    if (seg.key === 'orders_active') {
      scan('active_orders', arr, o => ({
        title: `${o.file_no || o.id} (${o.buyer || ''})`,
        detail: `Style: ${o.style_no || ''} | Qty: ${o.order_qty || 0} | Status: ${o.status || ''}`,
        text: `${o.file_no || ''} ${o.buyer || ''} ${o.style_no || ''} ${o.color || ''}`
      }));
    } else if (seg.key === 'archives_5y') {
      scan('buyer_data_bank_5y', arr, a => ({
        title: `${a.file_no || a.erp_order || ''} (${a.buyer || ''})`,
        detail: `Closed: ${a.close_date || ''} | Del: ${a.total_delivered || a.final_delivered_qty || 0} pcs`,
        text: `${a.file_no || ''} ${a.buyer || ''} ${a.style_no || ''} ${a.close_date || ''}`
      }));
    } else if (seg.key === 'rejections_5y') {
      scan('wash_rejections', arr, r => ({
        title: `${r.erpNo || ''} (${r.buyer || ''} • ${r.colour || ''})`,
        detail: `${r.rejectionType || ''}: ${r.ttl || 0} pcs (${r.remarks || ''})`,
        text: `${r.erpNo || ''} ${r.buyer || ''} ${r.colour || ''} ${r.rejectionType || ''} ${r.remarks || ''}`
      }));
    } else if (seg.key === 'memories_5y') {
      scan('support_memory_5y', arr, m => ({
        title: `[${m.date || ''}] ${m.query || ''}`,
        detail: m.summary || '',
        text: `${m.date || ''} ${m.query || ''} ${m.summary || ''}`
      }));
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return {
    cachedBytes,
    hits: hits.slice(0, 6).map(({ source, title, detail }) => ({ source, title, detail }))
  };
}

export async function clear100MbBrowserCache(): Promise<BrowserCacheStats> {
  const db = await openCacheDb();
  if (db) {
    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  return get100MbCacheStats();
}
