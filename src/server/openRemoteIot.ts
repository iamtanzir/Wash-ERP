import type { DatabaseAdapter } from "./db/index.js";

export type OpenRemoteAssetType =
  | "BuildingAsset"
  | "RoomAsset"
  | "WashMachineAsset"
  | "DryerAsset"
  | "OzoneAsset"
  | "WaterSensorAsset"
  | "RFIDGatewayAsset"
  | "ElectricityMeterAsset";

export type OpenRemoteProtocol =
  | "MQTT"
  | "Modbus-TCP"
  | "HTTP-Agent"
  | "OPC-UA"
  | "OpenRemote-Edge";

export interface OpenRemoteAttribute {
  name: string;
  label: string;
  type: "number" | "string" | "boolean";
  unit?: string;
  value: number | string | boolean;
  meta?: {
    readOnly?: boolean;
    ruleWatched?: boolean;
    min?: number;
    max?: number;
  };
  timestamp: number;
}

export interface OpenRemoteAsset {
  id: string;
  name: string;
  type: OpenRemoteAssetType;
  realm: string;
  parentId: string | null;
  protocol: OpenRemoteProtocol;
  zone: string;
  linkedOrderRef?: string;
  linkedBuyer?: string;
  online: boolean;
  createdOn: number;
  updatedOn: number;
  attributes: Record<string, OpenRemoteAttribute>;
}

export interface OpenRemoteRule {
  id: string;
  name: string;
  realm: string;
  enabled: boolean;
  assetId: string;
  assetName: string;
  attributeName: string;
  operator: ">" | "<" | "==" | "!=";
  threshold: number | string | boolean;
  thenAction: string;
  severity: "info" | "warning" | "critical";
  triggerCount: number;
  lastTriggered?: number;
}

export interface OpenRemoteEventLog {
  id: string;
  timestamp: number;
  realm: string;
  assetId: string;
  assetName: string;
  eventType: "TELEMETRY" | "RULE_TRIGGERED" | "ATTRIBUTE_WRITE" | "RFID_SCAN" | "EXTERNAL_SYNC";
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface OpenRemoteBridgeConfig {
  id: string;
  mode: "embedded" | "hybrid-bridge";
  managerUrl: string;
  realm: string;
  clientId: string;
  mqttTopicPrefix: string;
  pollIntervalSec: number;
  lastSyncAt?: number;
  lastSyncStatus?: string;
}

const ASSETS_COL = "iot_assets";
const RULES_COL = "iot_rules";
const EVENTS_COL = "iot_events";
const CONFIG_COL = "iot_config";

function nowTs(): number {
  return Date.now();
}

function buildDefaultAssets(orders: any[] = []): OpenRemoteAsset[] {
  const ts = nowTs();
  const activeOrders = Array.isArray(orders) ? orders.filter((o: any) => o.status !== "Closed") : [];
  const sampleOrder1 = activeOrders[0];
  const sampleOrder2 = activeOrders[1] || activeOrders[0];

  return [
    {
      id: "or-asset-plant-root",
      name: "INCTL Wash Floor Root",
      type: "BuildingAsset",
      realm: "wash-factory",
      parentId: null,
      protocol: "OpenRemote-Edge",
      zone: "Main Plant",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        ambientTempC: { name: "ambientTempC", label: "Floor Ambient Temp", type: "number", unit: "°C", value: 29.4, timestamp: ts },
        humidityPct: { name: "humidityPct", label: "Relative Humidity", type: "number", unit: "%", value: 64, timestamp: ts },
        activePowerKw: { name: "activePowerKw", label: "Total Plant Load", type: "number", unit: "kW", value: 184.6, timestamp: ts },
        connectedThings: { name: "connectedThings", label: "Connected Assets", type: "number", unit: "nodes", value: 7, timestamp: ts }
      }
    },
    {
      id: "or-asset-tonello-01",
      name: "Tonello Belly Washer #01",
      type: "WashMachineAsset",
      realm: "wash-factory",
      parentId: "or-asset-plant-root",
      protocol: "Modbus-TCP",
      zone: "Wet Process Zone A",
      linkedOrderRef: sampleOrder1?.file_no || "111-1111",
      linkedBuyer: sampleOrder1?.buyer || "NEXT",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        cyclePhase: { name: "cyclePhase", label: "Cycle Phase", type: "string", value: "Enzyme Washing", timestamp: ts },
        drumTempC: { name: "drumTempC", label: "Drum Temp", type: "number", unit: "°C", value: 58.2, meta: { ruleWatched: true, max: 75 }, timestamp: ts },
        drumRpm: { name: "drumRpm", label: "Drum Speed", type: "number", unit: "RPM", value: 36, timestamp: ts },
        waterLiters: { name: "waterLiters", label: "Water Intake", type: "number", unit: "L", value: 640, timestamp: ts },
        powerKw: { name: "powerKw", label: "Motor Draw", type: "number", unit: "kW", value: 28.5, timestamp: ts },
        batchPcs: { name: "batchPcs", label: "Current Batch Load", type: "number", unit: "pcs", value: 220, timestamp: ts },
        steamValveOpen: { name: "steamValveOpen", label: "Steam Inlet Valve", type: "boolean", value: true, meta: { readOnly: false }, timestamp: ts }
      }
    },
    {
      id: "or-asset-tonello-02",
      name: "Belly Washer #02 (Heavy Indigo)",
      type: "WashMachineAsset",
      realm: "wash-factory",
      parentId: "or-asset-plant-root",
      protocol: "MQTT",
      zone: "Wet Process Zone A",
      linkedOrderRef: sampleOrder2?.file_no || "112-2045",
      linkedBuyer: sampleOrder2?.buyer || "H&M",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        cyclePhase: { name: "cyclePhase", label: "Cycle Phase", type: "string", value: "Neutralizing Rinse", timestamp: ts },
        drumTempC: { name: "drumTempC", label: "Drum Temp", type: "number", unit: "°C", value: 44.8, meta: { ruleWatched: true, max: 75 }, timestamp: ts },
        drumRpm: { name: "drumRpm", label: "Drum Speed", type: "number", unit: "RPM", value: 32, timestamp: ts },
        waterLiters: { name: "waterLiters", label: "Water Intake", type: "number", unit: "L", value: 580, timestamp: ts },
        powerKw: { name: "powerKw", label: "Motor Draw", type: "number", unit: "kW", value: 24.1, timestamp: ts },
        batchPcs: { name: "batchPcs", label: "Current Batch Load", type: "number", unit: "pcs", value: 185, timestamp: ts },
        steamValveOpen: { name: "steamValveOpen", label: "Steam Inlet Valve", type: "boolean", value: false, meta: { readOnly: false }, timestamp: ts }
      }
    },
    {
      id: "or-asset-ozone-01",
      name: "Laser & Ozone Cabinet #01",
      type: "OzoneAsset",
      realm: "wash-factory",
      parentId: "or-asset-plant-root",
      protocol: "OPC-UA",
      zone: "Dry Process & Ozone",
      linkedOrderRef: sampleOrder1?.file_no || "111-1111",
      linkedBuyer: sampleOrder1?.buyer || "NEXT",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        cyclePhase: { name: "cyclePhase", label: "Treatment Stage", type: "string", value: "Ozone Fade Cycle", timestamp: ts },
        ozonePpm: { name: "ozonePpm", label: "Ozone Chamber Level", type: "number", unit: "ppm", value: 14.2, meta: { ruleWatched: true, max: 25 }, timestamp: ts },
        exhaustTempC: { name: "exhaustTempC", label: "Catalyst Temp", type: "number", unit: "°C", value: 39.6, timestamp: ts },
        powerKw: { name: "powerKw", label: "Power Draw", type: "number", unit: "kW", value: 19.4, timestamp: ts },
        batchPcs: { name: "batchPcs", label: "Chamber Pcs", type: "number", unit: "pcs", value: 140, timestamp: ts }
      }
    },
    {
      id: "or-asset-dryer-01",
      name: "Steam Tumbler Dryer #01",
      type: "DryerAsset",
      realm: "wash-factory",
      parentId: "or-asset-plant-root",
      protocol: "Modbus-TCP",
      zone: "Dryer & Curing Bay",
      linkedOrderRef: sampleOrder2?.file_no || "112-2045",
      linkedBuyer: sampleOrder2?.buyer || "H&M",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        cyclePhase: { name: "cyclePhase", label: "State", type: "string", value: "High Heat Tumble", timestamp: ts },
        chamberTempC: { name: "chamberTempC", label: "Chamber Temp", type: "number", unit: "°C", value: 78.5, meta: { ruleWatched: true, max: 95 }, timestamp: ts },
        steamBar: { name: "steamBar", label: "Steam Pressure", type: "number", unit: "bar", value: 6.4, timestamp: ts },
        moisturePct: { name: "moisturePct", label: "Garment Moisture", type: "number", unit: "%", value: 11.2, timestamp: ts },
        powerKw: { name: "powerKw", label: "Blower Load", type: "number", unit: "kW", value: 15.8, timestamp: ts }
      }
    },
    {
      id: "or-asset-etp-sensor",
      name: "ETP Effluent & Water Telemetry",
      type: "WaterSensorAsset",
      realm: "wash-factory",
      parentId: "or-asset-plant-root",
      protocol: "HTTP-Agent",
      zone: "Boiler & ETP Utility",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        phLevel: { name: "phLevel", label: "Effluent pH", type: "number", unit: "pH", value: 7.4, meta: { ruleWatched: true, min: 6.0, max: 8.5 }, timestamp: ts },
        flowRateLpm: { name: "flowRateLpm", label: "Recycle Flow Rate", type: "number", unit: "L/min", value: 312, timestamp: ts },
        tdsPpm: { name: "tdsPpm", label: "TDS Solids", type: "number", unit: "ppm", value: 890, timestamp: ts },
        dischargeValveOpen: { name: "dischargeValveOpen", label: "Recycle Pump Valve", type: "boolean", value: true, meta: { readOnly: false }, timestamp: ts }
      }
    },
    {
      id: "or-asset-rfid-gate",
      name: "UHF RFID Sewing-to-Wash Portal",
      type: "RFIDGatewayAsset",
      realm: "wash-factory",
      parentId: "or-asset-plant-root",
      protocol: "MQTT",
      zone: "Receiving Dock & Finishing",
      linkedOrderRef: sampleOrder1?.file_no || "111-1111",
      linkedBuyer: sampleOrder1?.buyer || "NEXT",
      online: true,
      createdOn: ts,
      updatedOn: ts,
      attributes: {
        lastScannedBundle: { name: "lastScannedBundle", label: "Last Bundle EPC", type: "string", value: "EPC-NEXT-111-B08", timestamp: ts },
        scannedTodayPcs: { name: "scannedTodayPcs", label: "Auto-Counted Pcs Today", type: "number", unit: "pcs", value: 640, timestamp: ts },
        gateThroughputPerHr: { name: "gateThroughputPerHr", label: "Hourly Tag Rate", type: "number", unit: "pcs/h", value: 215, timestamp: ts },
        rssiDbm: { name: "rssiDbm", label: "Antenna Signal", type: "number", unit: "dBm", value: -48, timestamp: ts }
      }
    }
  ];
}

function buildDefaultRules(): OpenRemoteRule[] {
  return [
    {
      id: "or-rule-temp-high",
      name: "Belly Washer #01 Over-Temp Guard",
      realm: "wash-factory",
      enabled: true,
      assetId: "or-asset-tonello-01",
      assetName: "Tonello Belly Washer #01",
      attributeName: "drumTempC",
      operator: ">",
      threshold: 75,
      thenAction: "Throttle Steam Inlet Valve & Notify Floor Supervisor",
      severity: "critical",
      triggerCount: 0
    },
    {
      id: "or-rule-etp-ph",
      name: "ETP Effluent pH Neutralization Alert",
      realm: "wash-factory",
      enabled: true,
      assetId: "or-asset-etp-sensor",
      assetName: "ETP Effluent & Water Telemetry",
      attributeName: "phLevel",
      operator: ">",
      threshold: 8.5,
      thenAction: "Trigger Dosing Pump & Hold Recycle Discharge",
      severity: "warning",
      triggerCount: 0
    },
    {
      id: "or-rule-dryer-overheat",
      name: "Steam Dryer #01 Scorch Protection",
      realm: "wash-factory",
      enabled: true,
      assetId: "or-asset-dryer-01",
      assetName: "Steam Tumbler Dryer #01",
      attributeName: "chamberTempC",
      operator: ">",
      threshold: 95,
      thenAction: "Activate Cool-Down Purge & Alert Operator",
      severity: "critical",
      triggerCount: 0
    }
  ];
}

function buildDefaultConfig(): OpenRemoteBridgeConfig {
  return {
    id: "default",
    mode: "embedded",
    managerUrl: process.env.OPENREMOTE_URL || "https://127.0.0.1",
    realm: process.env.OPENREMOTE_REALM || "wash-factory",
    clientId: process.env.OPENREMOTE_CLIENT_ID || "openremote-erp-bridge",
    mqttTopicPrefix: "wash-factory/sensors/#",
    pollIntervalSec: 15,
    lastSyncAt: nowTs(),
    lastSyncStatus: "Embedded OpenRemote Core Engine Active"
  };
}

export async function ensureOpenRemoteSeeded(db: DatabaseAdapter): Promise<{
  assets: OpenRemoteAsset[];
  rules: OpenRemoteRule[];
  events: OpenRemoteEventLog[];
  config: OpenRemoteBridgeConfig;
}> {
  let [assets, rules, events, config] = await Promise.all([
    db.getDocs(ASSETS_COL).catch(() => []),
    db.getDocs(RULES_COL).catch(() => []),
    db.getDocs(EVENTS_COL).catch(() => []),
    db.getDoc(CONFIG_COL, "default").catch(() => null)
  ]);

  if (!Array.isArray(assets) || assets.length === 0) {
    const orders = await db.getDocs("erp_orders").catch(() => []);
    assets = buildDefaultAssets(orders);
    for (const a of assets) {
      await db.setDoc(ASSETS_COL, a.id, a).catch(() => {});
    }
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    rules = buildDefaultRules();
    for (const r of rules) {
      await db.setDoc(RULES_COL, r.id, r).catch(() => {});
    }
  }

  if (!Array.isArray(events)) {
    events = [];
  }

  if (!config) {
    config = buildDefaultConfig();
    await db.setDoc(CONFIG_COL, "default", config).catch(() => {});
  }

  return { assets, rules, events, config };
}

function evaluateRuleCondition(
  actual: number | string | boolean,
  operator: OpenRemoteRule["operator"],
  threshold: number | string | boolean
): boolean {
  if (typeof actual === "number" && typeof threshold === "number") {
    if (operator === ">") return actual > threshold;
    if (operator === "<") return actual < threshold;
    if (operator === "==") return actual === threshold;
    if (operator === "!=") return actual !== threshold;
  }
  const aStr = String(actual);
  const tStr = String(threshold);
  if (operator === "==") return aStr === tStr;
  if (operator === "!=") return aStr !== tStr;
  return false;
}

export async function evaluateRulesForAsset(
  db: DatabaseAdapter,
  asset: OpenRemoteAsset,
  rules: OpenRemoteRule[]
): Promise<OpenRemoteEventLog[]> {
  const triggeredEvents: OpenRemoteEventLog[] = [];
  const ts = nowTs();

  for (const rule of rules) {
    if (!rule.enabled || rule.assetId !== asset.id) continue;
    const attr = asset.attributes?.[rule.attributeName];
    if (!attr) continue;

    if (evaluateRuleCondition(attr.value, rule.operator, rule.threshold)) {
      rule.triggerCount = (rule.triggerCount || 0) + 1;
      rule.lastTriggered = ts;
      await db.setDoc(RULES_COL, rule.id, rule).catch(() => {});

      const evt: OpenRemoteEventLog = {
        id: `or-evt-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: ts,
        realm: asset.realm,
        assetId: asset.id,
        assetName: asset.name,
        eventType: "RULE_TRIGGERED",
        severity: rule.severity,
        message: `When [${rule.attributeName} ${rule.operator} ${rule.threshold}] (actual: ${attr.value}${attr.unit || ""}) -> ${rule.thenAction}`
      };
      await db.setDoc(EVENTS_COL, evt.id, evt).catch(() => {});
      triggeredEvents.push(evt);
    }
  }

  return triggeredEvents;
}

function jitter(val: number, delta: number, min: number, max: number, decimals = 1): number {
  const next = val + (Math.random() * 2 - 1) * delta;
  const clamped = Math.max(min, Math.min(max, next));
  return Number(clamped.toFixed(decimals));
}

export async function simulateTelemetryPulse(db: DatabaseAdapter): Promise<{
  assets: OpenRemoteAsset[];
  triggeredEvents: OpenRemoteEventLog[];
}> {
  const { assets, rules } = await ensureOpenRemoteSeeded(db);
  const ts = nowTs();
  const triggeredEvents: OpenRemoteEventLog[] = [];

  for (const asset of assets) {
    if (!asset.online || !asset.attributes) continue;
    const attrs = asset.attributes;

    if (asset.type === "WashMachineAsset") {
      if (attrs.drumTempC) attrs.drumTempC = { ...attrs.drumTempC, value: jitter(Number(attrs.drumTempC.value), 1.8, 35, 78), timestamp: ts };
      if (attrs.drumRpm) attrs.drumRpm = { ...attrs.drumRpm, value: jitter(Number(attrs.drumRpm.value), 3, 22, 48, 0), timestamp: ts };
      if (attrs.powerKw) attrs.powerKw = { ...attrs.powerKw, value: jitter(Number(attrs.powerKw.value), 1.5, 16, 36), timestamp: ts };
    } else if (asset.type === "OzoneAsset") {
      if (attrs.ozonePpm) attrs.ozonePpm = { ...attrs.ozonePpm, value: jitter(Number(attrs.ozonePpm.value), 1.2, 6, 22), timestamp: ts };
      if (attrs.exhaustTempC) attrs.exhaustTempC = { ...attrs.exhaustTempC, value: jitter(Number(attrs.exhaustTempC.value), 1.0, 30, 52), timestamp: ts };
    } else if (asset.type === "DryerAsset") {
      if (attrs.chamberTempC) attrs.chamberTempC = { ...attrs.chamberTempC, value: jitter(Number(attrs.chamberTempC.value), 2.1, 58, 92), timestamp: ts };
      if (attrs.moisturePct) attrs.moisturePct = { ...attrs.moisturePct, value: jitter(Number(attrs.moisturePct.value), 0.8, 4, 18), timestamp: ts };
    } else if (asset.type === "WaterSensorAsset") {
      if (attrs.phLevel) attrs.phLevel = { ...attrs.phLevel, value: jitter(Number(attrs.phLevel.value), 0.25, 6.2, 8.6, 2), timestamp: ts };
      if (attrs.flowRateLpm) attrs.flowRateLpm = { ...attrs.flowRateLpm, value: jitter(Number(attrs.flowRateLpm.value), 14, 220, 420, 0), timestamp: ts };
    } else if (asset.type === "RFIDGatewayAsset") {
      if (attrs.scannedTodayPcs) {
        const inc = Math.floor(Math.random() * 6);
        attrs.scannedTodayPcs = { ...attrs.scannedTodayPcs, value: Number(attrs.scannedTodayPcs.value) + inc, timestamp: ts };
      }
      if (attrs.gateThroughputPerHr) attrs.gateThroughputPerHr = { ...attrs.gateThroughputPerHr, value: jitter(Number(attrs.gateThroughputPerHr.value), 12, 160, 280, 0), timestamp: ts };
    } else if (asset.type === "BuildingAsset") {
      if (attrs.ambientTempC) attrs.ambientTempC = { ...attrs.ambientTempC, value: jitter(Number(attrs.ambientTempC.value), 0.4, 25, 34), timestamp: ts };
      if (attrs.activePowerKw) attrs.activePowerKw = { ...attrs.activePowerKw, value: jitter(Number(attrs.activePowerKw.value), 6, 140, 230), timestamp: ts };
    }

    asset.updatedOn = ts;
    await db.setDoc(ASSETS_COL, asset.id, asset).catch(() => {});

    const evts = await evaluateRulesForAsset(db, asset, rules);
    triggeredEvents.push(...evts);
  }

  return { assets, triggeredEvents };
}

export async function writeAssetAttribute(
  db: DatabaseAdapter,
  params: {
    assetId: string;
    attributeName: string;
    value: number | string | boolean;
    source?: string;
    linkedOrderRef?: string;
  }
): Promise<{
  asset: OpenRemoteAsset;
  triggeredEvents: OpenRemoteEventLog[];
}> {
  const { assets, rules } = await ensureOpenRemoteSeeded(db);
  const asset = assets.find(a => a.id === params.assetId);
  if (!asset) {
    throw new Error(`OpenRemote asset '${params.assetId}' not found`);
  }

  const ts = nowTs();
  const existing = asset.attributes?.[params.attributeName];
  if (existing) {
    asset.attributes[params.attributeName] = {
      ...existing,
      value: params.value,
      timestamp: ts
    };
  } else {
    const inferredType: OpenRemoteAttribute["type"] =
      typeof params.value === "boolean"
        ? "boolean"
        : typeof params.value === "number"
        ? "number"
        : "string";
    asset.attributes[params.attributeName] = {
      name: params.attributeName,
      label: params.attributeName,
      type: inferredType,
      value: params.value,
      timestamp: ts
    };
  }

  if (params.linkedOrderRef !== undefined) {
    asset.linkedOrderRef = params.linkedOrderRef;
  }
  asset.updatedOn = ts;
  await db.setDoc(ASSETS_COL, asset.id, asset);

  const writeEvt: OpenRemoteEventLog = {
    id: `or-evt-${ts}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: ts,
    realm: asset.realm,
    assetId: asset.id,
    assetName: asset.name,
    eventType: params.source === "rfid" ? "RFID_SCAN" : "ATTRIBUTE_WRITE",
    severity: "info",
    message: `Updated ${params.attributeName} = ${params.value}${existing?.unit ? " " + existing.unit : ""} via ${params.source || "Manager UI"}`
  };
  await db.setDoc(EVENTS_COL, writeEvt.id, writeEvt).catch(() => {});

  const ruleEvts = await evaluateRulesForAsset(db, asset, rules);

  return { asset, triggeredEvents: [writeEvt, ...ruleEvts] };
}

export async function createOpenRemoteAsset(
  db: DatabaseAdapter,
  payload: {
    name: string;
    type: OpenRemoteAssetType;
    protocol: OpenRemoteProtocol;
    zone: string;
    parentId?: string | null;
    linkedOrderRef?: string;
    linkedBuyer?: string;
    initialAttributeName?: string;
    initialAttributeValue?: number | string | boolean;
    initialAttributeUnit?: string;
  }
): Promise<OpenRemoteAsset> {
  const ts = nowTs();
  const id = `or-asset-${ts}-${Math.random().toString(36).slice(2, 6)}`;
  const attrName = (payload.initialAttributeName || "status").trim();
  const attrVal = payload.initialAttributeValue ?? "Active";
  const attrType: OpenRemoteAttribute["type"] =
    typeof attrVal === "boolean" ? "boolean" : typeof attrVal === "number" ? "number" : "string";

  const asset: OpenRemoteAsset = {
    id,
    name: payload.name.trim(),
    type: payload.type || "WashMachineAsset",
    realm: "wash-factory",
    parentId: payload.parentId ?? "or-asset-plant-root",
    protocol: payload.protocol || "MQTT",
    zone: payload.zone?.trim() || "Wash Floor",
    linkedOrderRef: payload.linkedOrderRef?.trim() || undefined,
    linkedBuyer: payload.linkedBuyer?.trim() || undefined,
    online: true,
    createdOn: ts,
    updatedOn: ts,
    attributes: {
      [attrName]: {
        name: attrName,
        label: attrName,
        type: attrType,
        unit: payload.initialAttributeUnit || undefined,
        value: attrVal,
        timestamp: ts
      }
    }
  };

  await db.setDoc(ASSETS_COL, asset.id, asset);

  const evt: OpenRemoteEventLog = {
    id: `or-evt-${ts}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: ts,
    realm: asset.realm,
    assetId: asset.id,
    assetName: asset.name,
    eventType: "ATTRIBUTE_WRITE",
    severity: "info",
    message: `Provisioned new ${asset.type} (${asset.protocol}) in zone "${asset.zone}"`
  };
  await db.setDoc(EVENTS_COL, evt.id, evt).catch(() => {});

  return asset;
}

export async function syncExternalOpenRemoteManager(
  db: DatabaseAdapter,
  configOverride?: Partial<OpenRemoteBridgeConfig>
): Promise<{
  connected: boolean;
  importedCount: number;
  statusMessage: string;
  config: OpenRemoteBridgeConfig;
}> {
  const { config } = await ensureOpenRemoteSeeded(db);
  const nextConfig: OpenRemoteBridgeConfig = {
    ...config,
    ...configOverride,
    id: "default",
    lastSyncAt: nowTs()
  };

  if (nextConfig.mode === "embedded" || !nextConfig.managerUrl) {
    nextConfig.lastSyncStatus = "Embedded OpenRemote Core Engine Synchronized";
    await db.setDoc(CONFIG_COL, "default", nextConfig).catch(() => {});
    return {
      connected: true,
      importedCount: 0,
      statusMessage: nextConfig.lastSyncStatus,
      config: nextConfig
    };
  }

  try {
    const cleanUrl = nextConfig.managerUrl.replace(/\/+$/, "");
    const realm = encodeURIComponent(nextConfig.realm || "master");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${cleanUrl}/api/${realm}/asset/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenRemote REST HTTP ${res.status}`);
    }
    const remoteAssets = await res.json();
    let importedCount = 0;
    if (Array.isArray(remoteAssets)) {
      for (const ra of remoteAssets.slice(0, 25)) {
        if (!ra?.id || !ra?.name) continue;
        const ts = nowTs();
        const mappedAttrs: Record<string, OpenRemoteAttribute> = {};
        for (const [k, v] of Object.entries<any>(ra.attributes || {})) {
          mappedAttrs[k] = {
            name: k,
            label: k,
            type: typeof v?.value === "number" ? "number" : typeof v?.value === "boolean" ? "boolean" : "string",
            value: v?.value ?? "",
            timestamp: v?.timestamp || ts
          };
        }
        const localAsset: OpenRemoteAsset = {
          id: String(ra.id),
          name: String(ra.name),
          type: (ra.type as OpenRemoteAssetType) || "WashMachineAsset",
          realm: ra.realm || nextConfig.realm,
          parentId: ra.parentId || "or-asset-plant-root",
          protocol: "OpenRemote-Edge",
          zone: "External OpenRemote Manager",
          online: true,
          createdOn: ra.createdOn || ts,
          updatedOn: ts,
          attributes: mappedAttrs
        };
        await db.setDoc(ASSETS_COL, localAsset.id, localAsset).catch(() => {});
        importedCount++;
      }
    }

    nextConfig.lastSyncStatus = `Connected to ${cleanUrl} (${importedCount} assets synced)`;
    await db.setDoc(CONFIG_COL, "default", nextConfig).catch(() => {});
    return {
      connected: true,
      importedCount,
      statusMessage: nextConfig.lastSyncStatus,
      config: nextConfig
    };
  } catch (err: any) {
    nextConfig.lastSyncStatus = `Bridge fallback to Embedded Engine (${err?.message || "Unreachable"})`;
    await db.setDoc(CONFIG_COL, "default", nextConfig).catch(() => {});
    return {
      connected: false,
      importedCount: 0,
      statusMessage: nextConfig.lastSyncStatus,
      config: nextConfig
    };
  }
}
