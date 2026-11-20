// Instant route chunk preloading on hover/focus (Hugo-style zero-latency navigation)
const prefetchedRoutes = new Set<string>();

const routeImporters: Record<string, () => Promise<unknown>> = {
  "/": () => import("../pages/Dashboard"),
  "/wash-floor-live": () => import("../pages/WashFloorLive"),
  "/new-plan": () => import("../pages/NewERPPlan"),
  "/daily-update": () => import("../pages/DailyUpdate"),
  "/wash-mc-plan": () => import("../pages/WashMcLoadPlan"),
  "/shift-production": () => import("../pages/ShiftProductionReport"),
  "/wash-rejection": () => import("../pages/WashRejectionReport"),
  "/cpl-report": () => import("../pages/CPLReport"),
  "/hm-tod": () => import("../pages/HMTOD"),
  "/proactive-plan": () => import("../pages/ProactivePlan"),
  "/iot-tracking": () => import("../pages/IoTTracking"),
  "/open-erp": () => import("../pages/OpenSourceErpHub"),
  "/close-order": () => import("../pages/CloseOrder"),
  "/data-bank": () => import("../pages/DataBank"),
  "/admin": () => import("../pages/Admin"),
};

export function prefetchRoute(path: string): void {
  if (prefetchedRoutes.has(path)) return;
  const loader = routeImporters[path];
  if (!loader) return;
  prefetchedRoutes.add(path);
  loader().catch(() => {
    prefetchedRoutes.delete(path);
  });
}
