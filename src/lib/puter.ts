/**
 * Puter Serverless Technology Integration for INCTL Wash ERP
 * Docs: https://developer.puter.com/
 * 
 * Exclusively uses Puter's Serverless Technology:
 * - Serverless Key-Value Data Store (puter.kv) with zero server infrastructure
 * - Serverless Global Static Hosting (puter.hosting) with automated edge CDN
 * - Client-side on-demand loader to ensure zero footprint on initial page loads
 */

declare global {
  interface Window {
    puter?: {
      kv: {
        set: (key: string, value: any) => Promise<any>;
        get: (key: string) => Promise<any>;
        del: (key: string) => Promise<any>;
        list: (pattern?: string) => Promise<string[]>;
        flush: () => Promise<any>;
      };
      hosting?: {
        create: (subdomain: string, dir: string) => Promise<any>;
        list: () => Promise<any[]>;
      };
      ai?: {
        chat: (prompt: string, options?: { model?: string; stream?: boolean }) => Promise<any>;
      };
    };
  }
}

let puterLoadPromise: Promise<boolean> | null = null;

/**
 * Dynamically load the Puter.js serverless SDK on demand.
 * This guarantees zero overhead and maximum optimization for the rest of the ERP.
 */
export async function loadPuterServerless(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.puter && window.puter.kv) return true;

  if (!puterLoadPromise) {
    puterLoadPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[src*="js.puter.com"]');
      if (existing) {
        if (window.puter?.kv) {
          resolve(true);
        } else {
          existing.addEventListener('load', () => resolve(!!window.puter?.kv));
          existing.addEventListener('error', () => resolve(false));
        }
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      script.onload = () => resolve(!!window.puter?.kv);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  return puterLoadPromise;
}

export const isPuterAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.puter !== 'undefined' && typeof window.puter.kv !== 'undefined';
};

/**
 * Serverless Key-Value: Sync real-time KPI metrics into Puter Cloud KV store
 */
export async function syncKpisToPuterKv(kpis: Record<string, any>): Promise<{ success: boolean; latencyMs: number }> {
  const ready = await loadPuterServerless();
  if (!ready || !window.puter?.kv) {
    return { success: false, latencyMs: 0 };
  }

  const startTime = performance.now();
  try {
    await window.puter.kv.set('inctl_serverless_kpi', {
      ...kpis,
      syncedAt: new Date().toISOString()
    });
    const latencyMs = Math.round(performance.now() - startTime);
    return { success: true, latencyMs };
  } catch (e) {
    console.error('[Puter Serverless KV Error]', e);
    return { success: false, latencyMs: 0 };
  }
}

/**
 * Serverless Key-Value: Fetch real-time KPI metrics from Puter Cloud KV store
 */
export async function getKpisFromPuterKv(): Promise<any | null> {
  const ready = await loadPuterServerless();
  if (!ready || !window.puter?.kv) return null;
  try {
    return await window.puter.kv.get('inctl_serverless_kpi');
  } catch (e) {
    console.error('[Puter Serverless KV Read Error]', e);
    return null;
  }
}

/**
 * Serverless Key-Value: Generic Set
 */
export async function setPuterKvKey(key: string, value: any): Promise<boolean> {
  const ready = await loadPuterServerless();
  if (!ready || !window.puter?.kv) return false;
  try {
    await window.puter.kv.set(key, value);
    return true;
  } catch (e) {
    console.error(`[Puter Serverless KV Set Error: ${key}]`, e);
    return false;
  }
}

/**
 * Serverless Key-Value: Generic Get
 */
export async function getPuterKvKey<T = any>(key: string): Promise<T | null> {
  const ready = await loadPuterServerless();
  if (!ready || !window.puter?.kv) return null;
  try {
    return await window.puter.kv.get(key);
  } catch (e) {
    console.error(`[Puter Serverless KV Get Error: ${key}]`, e);
    return null;
  }
}

/**
 * Serverless Key-Value: Quick Diagnostic & Speed Test
 */
export async function testPuterServerlessKV(): Promise<{ success: boolean; latencyMs: number; status: string }> {
  const ready = await loadPuterServerless();
  if (!ready || !window.puter?.kv) {
    return {
      success: false,
      latencyMs: 0,
      status: 'Puter serverless runtime failed to initialize. Check internet connection.'
    };
  }

  const testKey = 'inctl_diag_ping';
  const testVal = { ping: Date.now(), agent: 'INCTL Wash ERP Serverless Engine' };
  const startTime = performance.now();

  try {
    await window.puter.kv.set(testKey, testVal);
    const retrieved = await window.puter.kv.get(testKey);
    const latencyMs = Math.round(performance.now() - startTime);

    if (retrieved && retrieved.ping === testVal.ping) {
      return {
        success: true,
        latencyMs,
        status: `Serverless KV operational! Read/Write completed in ${latencyMs}ms.`
      };
    }
    return {
      success: false,
      latencyMs,
      status: 'Data mismatch during serverless KV verification.'
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: 0,
      status: `Serverless KV test failed: ${err?.message || err}`
    };
  }
}

/**
 * Generate CLI / script command for Puter serverless static hosting
 */
export function generatePuterDeploySnippet(subdomain: string = 'inctl-wash-erp'): string {
  return `# 1. Build optimized Rollup bundle (Zero-overhead production build)
npm run build

# 2. Deploy to Puter Serverless Global Edge CDN
puter.hosting.create("${subdomain}", "dist/")

# Access your live ERP on Puter serverless infrastructure:
# https://${subdomain}.puter.site`;
}

/**
 * Query Puter Serverless Free AI (Zero-config, client-side serverless)
 * Docs: https://developer.puter.com/
 */
export async function queryPuterServerlessAi(prompt: string, model: string = 'gpt-4o-mini'): Promise<string> {
  const ready = await loadPuterServerless();
  if (!ready || !window.puter?.ai?.chat) {
    throw new Error('Puter Serverless AI could not be initialized in this browser environment.');
  }
  const res = await window.puter.ai.chat(prompt, { model });
  if (typeof res === 'string') return res;
  if (res?.message?.content) return res.message.content;
  if (typeof res?.text === 'string') return res.text;
  return JSON.stringify(res);
}
