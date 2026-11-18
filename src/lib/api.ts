export interface Order {
  id: string;
  buyer: string;
  file_no: string;
  style_no: string;
  order_qty: number;
  wash_type: string;
  sew_floor: string;
  floor?: string;
  status: string;
  color: string;
  erp_date?: string;
  erp_ship_date?: string;
  cpl_qty_kg?: number;
  item?: string;
  plan?: string;
  remarks?: string;
  source_ref?: string;
  print_emb?: string;
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
  custom_values?: Record<string, any>;
}

export interface DailyLog {
  id: string;
  erp_order: string; // Keep original name for frontend compatibility
  log_date: string;
  received_qty: number;
  delivered_qty: number;
  unit: string;
  ready_for_delivery_qty?: number;
  remarks?: string;
  created_by?: string;
  expand?: {
    erp_order: Order;
  };
}

const fetchJSON = async (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem("erp_token") : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }
  
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`Server returned an invalid response. This often happens if a request takes too long (timeout) or a payload is too large. (Status: ${res.status})`);
  }
};

export const api = {
  async getActiveOrders(): Promise<Order[]> {
    const orders = await fetchJSON("/api/db/erp_orders");
    return orders.filter((o: Order) => o.status !== "Closed");
  },

  async getOrder(id: string): Promise<Order> {
    return fetchJSON(`/api/db/erp_orders/${id}`);
  },

  async getRecentLogs(limitVal = 50): Promise<{ items: DailyLog[] }> {
    const [logs, orders] = await Promise.all([
      fetchJSON("/api/db/daily_logs"),
      fetchJSON("/api/db/erp_orders")
    ]);
    
    const limitedLogs = logs.slice(0, limitVal);
    const ordersMap: Record<string, Order> = {};
    orders.forEach((o: Order) => {
      ordersMap[o.id] = o;
    });

    return {
        items: limitedLogs.map((l: DailyLog) => ({
            ...l,
            expand: { erp_order: ordersMap[l.erp_order] }
        }))
    };
  },

  async getLogsForOrder(orderId: string): Promise<DailyLog[]> {
    const logs = await fetchJSON("/api/db/daily_logs");
    return logs.filter((l: DailyLog) => l.erp_order === orderId);
  },

  async getAllDailyLogs(): Promise<DailyLog[]> {
    return fetchJSON("/api/db/daily_logs");
  },

  async submitDailyLog(data: Partial<DailyLog>): Promise<{ id: string }> {
    const log = await fetchJSON("/api/db/daily_logs", {
        method: "POST",
        body: JSON.stringify(data),
    });
    
    // Update order status if needed
    if (data.erp_order) {
        const order = await this.getOrder(data.erp_order);
        if (order.status === 'Pending' && ((data.received_qty || 0) > 0 || (data.delivered_qty || 0) > 0)) {
            await this.updateOrder(data.erp_order, { status: 'Running' });
        }
    }

    return log;
  },

  async updateOrder(id: string, data: Partial<Order>): Promise<void> {
    return fetchJSON(`/api/db/erp_orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
  },

  async batchSetOrders(operations: { id: string, data: any }[]): Promise<void> {
      return fetchJSON("/api/db/batch/erp_orders", {
          method: "POST",
          body: JSON.stringify({ operations: operations.map(op => ({ type: 'set', ...op })) }),
      });
  },

  async closeERPOrder(data: {
    erp_order_id: string;
    close_date: string;
    final_delivered: number;
    closed_by: string;
    confirmed: boolean;
  }) {
    if (!data.confirmed) {
      throw new Error("Confirmation checkbox is required");
    }

    const order = await this.getOrder(data.erp_order_id);
    const logs = await this.getLogsForOrder(data.erp_order_id);

    const totalRcv = logs.reduce((sum, log) => sum + (log.received_qty || 0), 0);
    const totalDel = logs.reduce((sum, log) => sum + (log.delivered_qty || 0), 0);

    const orderQty = order.order_qty || 0;

    if (totalDel < orderQty) {
      throw new Error(`Total delivered (${totalDel}) < Order qty (${orderQty})`);
    }
    if (data.final_delivered !== totalRcv) {
      throw new Error("Final delivered must equal total received");
    }

    await fetchJSON("/api/db/buyer_data_bank", {
      method: "POST",
      body: JSON.stringify({
        erp_order: data.erp_order_id,
        buyer: order.buyer,
        file_no: order.file_no,
        style_no: order.style_no,
        color: order.color,
        order_qty: orderQty,
        total_received: totalRcv,
        total_delivered: totalDel,
        close_date: data.close_date,
        final_delivered_qty: data.final_delivered,
        wash_type: order.wash_type,
        closed_by: data.closed_by,
        is_locked: true,
      })
    });

    await this.updateOrder(data.erp_order_id, { status: 'Closed' });

    return true;
  },

  async getArchiveData(filters?: any) {
    let url = "/api/db/buyer_data_bank";
    const data = await fetchJSON(url);
    
    if (!filters) return data;

    return data.filter((item: any) => {
      const matchBuyer = !filters.buyer || item.buyer === filters.buyer;
      const matchFile = !filters.file_no || item.file_no.toLowerCase().includes(filters.file_no.toLowerCase());
      const matchWash = !filters.wash_type || item.wash_type === filters.wash_type;
      
      let matchDate = true;
      if (filters.from_date || filters.to_date) {
        const closeDate = new Date(item.close_date).getTime();
        if (filters.from_date && closeDate < new Date(filters.from_date).getTime()) matchDate = false;
        if (filters.to_date && closeDate > new Date(filters.to_date).getTime() + 86400000) matchDate = false;
      }

      return matchBuyer && matchFile && matchWash && matchDate;
    });
  },

  async getOrderLogs(orderId: string): Promise<DailyLog[]> {
    const logs = await fetchJSON("/api/db/daily_logs");
    return logs.filter((l: DailyLog) => l.erp_order === orderId)
               .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  },

  async generateProactivePlan(payload: {
    orders?: any[];
    provider?: 'auto' | 'flm' | 'omniroute';
    options?: Record<string, any>;
  }): Promise<any> {
    return fetchJSON("/api/ai/proactive-plan", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getLatestProactivePlan(): Promise<any> {
    try {
      return await fetchJSON("/api/ai/proactive-plan/latest");
    } catch {
      return null;
    }
  },

  async simulatePlanningScenario(payload: {
    prompt: string;
    orders?: any[];
    currentPlan?: any;
    provider?: 'auto' | 'flm' | 'omniroute';
  }): Promise<any> {
    return fetchJSON("/api/ai/scenario-simulate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async chatWithErpAi(payload: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    provider?: 'auto' | 'flm' | 'omniroute';
    browserCacheContext?: { cachedBytes?: number; hits?: any[] };
  }): Promise<{
    reply: string;
    engineUsed: string;
    model: string;
    matchedOrdersCount: number;
    latencyMs: number;
    excelSheet?: {
      sheetName: string;
      fileName: string;
      columns: string[];
      rows: (string | number)[][];
      summaryRow?: (string | number)[];
      formulaSummary: string[];
    };
    formulaResult?: { expression: string; value: number | string; steps: string };
    appliedRulesCount?: number;
    intentDomain?: string;
    fiveYearHitsCount?: number;
  }> {
    return fetchJSON("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getSupportCacheSnapshot(): Promise<any> {
    return fetchJSON("/api/support/cache-snapshot");
  },

  async getSupport5YrMemory(): Promise<{ count: number; retentionStart: string; memories: any[] }> {
    return fetchJSON("/api/support/memory-5yr");
  },

  async getSupportHistory(): Promise<{ messages: any[] }> {
    return fetchJSON("/api/support/history");
  },

  async saveSupportHistory(messages: any[]): Promise<any> {
    return fetchJSON("/api/support/history", {
      method: "POST",
      body: JSON.stringify({ messages })
    });
  },

  async clearSupportHistory(): Promise<any> {
    return fetchJSON("/api/support/history", { method: "DELETE" });
  },

  async getSupportSkills(): Promise<any> {
    return fetchJSON("/api/support/skills");
  },

  async teachSupportSkill(payload: { trigger: string; ruleText: string; category?: string }): Promise<any> {
    return fetchJSON("/api/support/skills", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteSupportSkill(id: string): Promise<any> {
    return fetchJSON(`/api/support/skills/${id}`, { method: "DELETE" });
  },

  async submitSupportFeedback(payload: {
    messageId?: string;
    query: string;
    reply: string;
    rating: 'up' | 'down';
    correctionNote?: string;
  }): Promise<any> {
    return fetchJSON("/api/support/feedback", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getOpenRemoteState(): Promise<any> {
    return fetchJSON("/api/iot/openremote/state");
  },

  async pulseOpenRemoteTelemetry(): Promise<any> {
    return fetchJSON("/api/iot/openremote/pulse", { method: "POST" });
  },

  async createOpenRemoteAsset(payload: any): Promise<any> {
    return fetchJSON("/api/iot/openremote/asset", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteOpenRemoteAsset(id: string): Promise<any> {
    return fetchJSON(`/api/iot/openremote/asset/${id}`, { method: "DELETE" });
  },

  async writeOpenRemoteAttribute(assetId: string, payload: {
    attributeName: string;
    value: number | string | boolean;
    source?: string;
    linkedOrderRef?: string;
  }): Promise<any> {
    return fetchJSON(`/api/iot/openremote/asset/${assetId}/attribute`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async ingestOpenRemoteTelemetry(payload: {
    assetId: string;
    attributeName: string;
    value: number | string | boolean;
    source?: string;
    linkedOrderRef?: string;
    autoLogBundlePcs?: number;
  }): Promise<any> {
    return fetchJSON("/api/iot/openremote/ingest", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async saveOpenRemoteRule(payload: any): Promise<any> {
    return fetchJSON("/api/iot/openremote/rule", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteOpenRemoteRule(id: string): Promise<any> {
    return fetchJSON(`/api/iot/openremote/rule/${id}`, { method: "DELETE" });
  },

  async syncOpenRemoteBridge(payload: any): Promise<any> {
    return fetchJSON("/api/iot/openremote/bridge/sync", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getWashRejections(): Promise<{ entries: any[]; config: any }> {
    return fetchJSON("/api/wash-rejections");
  },

  async saveWashRejection(payload: any): Promise<any> {
    return fetchJSON("/api/wash-rejections", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async saveWashRejectionBatch(entries: any[]): Promise<any> {
    return fetchJSON("/api/wash-rejections/batch", {
      method: "POST",
      body: JSON.stringify({ entries })
    });
  },

  async saveWashRejectionConfig(payload: any): Promise<any> {
    return fetchJSON("/api/wash-rejections/config", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteWashRejection(id: string): Promise<any> {
    return fetchJSON(`/api/wash-rejections/${id}`, { method: "DELETE" });
  }
};
