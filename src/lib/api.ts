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
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
    const logs = await fetchJSON("/api/db/daily_logs");
    const limitedLogs = logs.slice(0, limitVal);
    
    // Manual Expansion
    const orderIds = Array.from(new Set(limitedLogs.map((l: DailyLog) => l.erp_order)));
    const ordersMap: Record<string, Order> = {};
    
    await Promise.all(orderIds.map(async (id: any) => {
        try {
            const order = await this.getOrder(id);
            ordersMap[id] = order;
        } catch (e) {
            console.error(`Failed to fetch order ${id}`, e);
        }
    }));

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

  async submitDailyLog(data: Partial<DailyLog>): Promise<{ id: string }> {
    if (data.delivered_qty! > data.received_qty!) {
      throw new Error("Delivered qty cannot exceed received qty");
    }

    const log = await fetchJSON("/api/db/daily_logs", {
        method: "POST",
        body: JSON.stringify(data),
    });
    
    // Update order status if needed
    if (data.erp_order) {
        const order = await this.getOrder(data.erp_order);
        if (order.status === 'Pending' && (data.received_qty! > 0 || data.delivered_qty! > 0)) {
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
  }
};
