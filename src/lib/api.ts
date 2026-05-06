import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    doc, 
    addDoc, 
    updateDoc, 
    orderBy, 
    limit,
    serverTimestamp 
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface Order {
  id: string;
  buyer: string;
  file_no: string;
  style_no: string;
  order_qty: number;
  color: string;
  wash_type: string;
  sew_floor: string;
  status: string;
  erp_date?: string;
  cpl_qty_kg?: number;
  item?: string;
  pp_plan?: string;
  print_emb?: string;
  source_ref?: string;
  work_order?: string;
  budget_price?: number;
  approval_price?: number;
  pi_no?: string;
  remarks?: string;
  created_at?: any;
  updated_at?: any;
}

export interface DailyLog {
  id: string;
  erp_order: string;
  log_date: string;
  received_qty: number;
  delivered_qty: number;
  unit: string;
  remarks: string;
  created_by: string;
  receive_challan?: string;
  delivery_challan?: string;
  ready_for_delivery_qty?: number;
  lab_samp_qty?: number;
  sub_factory?: string;
  expand?: {
    erp_order: Order;
  };
}

export const api = {
  async getActiveOrders() {
    // Basic version to avoid index errors initially
    const q = query(collection(db, "erp_orders"), where("status", "!=", "Closed"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  },

  async getOrder(id: string) {
    const snap = await getDoc(doc(db, "erp_orders", id));
    return { id: snap.id, ...snap.data() } as Order;
  },

  async getRecentLogs(limitVal = 50) {
    const q = query(
        collection(db, "daily_logs"), 
        orderBy("log_date", "desc"),
        limit(limitVal)
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyLog));
    
    // Manual Expansion
    const orderIds = Array.from(new Set(logs.map(l => l.erp_order)));
    const orders: Record<string, Order> = {};
    
    await Promise.all(orderIds.map(async (id) => {
        const oSnap = await getDoc(doc(db, "erp_orders", id));
        if (oSnap.exists()) {
            orders[id] = { id: oSnap.id, ...oSnap.data() } as Order;
        }
    }));

    return {
        items: logs.map(l => ({
            ...l,
            expand: { erp_order: orders[l.erp_order] }
        }))
    };
  },

  async getLogsForOrder(orderId: string) {
    const q = query(
        collection(db, "daily_logs"), 
        where("erp_order", "==", orderId),
        orderBy("log_date", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyLog));
  },

  async submitDailyLog(data: {
    erp_order: string;
    received_qty: number;
    delivered_qty: number;
    log_date: string;
    unit: string;
    remarks?: string;
    created_by: string;
  }) {
    if (data.delivered_qty > data.received_qty) {
      throw new Error("Delivered qty cannot exceed received qty");
    }

    const logRef = await addDoc(collection(db, "daily_logs"), {
        ...data,
        received_qty: Number(data.received_qty),
        delivered_qty: Number(data.delivered_qty),
        created_at: serverTimestamp()
    });
    
    const orderRef = doc(db, "erp_orders", data.erp_order);
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
        const order = orderSnap.data() as Order;
        if (order.status === 'Pending' && (data.received_qty > 0 || data.delivered_qty > 0)) {
            await updateDoc(orderRef, {
                status: 'Running',
                updated_at: serverTimestamp()
            });
        }
    }

    return { id: logRef.id };
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

    const orderRef = doc(db, "erp_orders", data.erp_order_id);
    const orderSnap = await getDoc(orderRef);
    const order = orderSnap.data() as Order;
    
    const logs = await this.getLogsForOrder(data.erp_order_id);

    const totalRcv = logs.reduce((sum, log) => sum + (log.received_qty || 0), 0);
    const totalDel = logs.reduce((sum, log) => sum + (log.delivered_qty || 0), 0);

    if (totalDel < order.order_qty) {
      throw new Error(`Total delivered (${totalDel}) < Order qty (${order.order_qty})`);
    }
    if (data.final_delivered !== totalRcv) {
      throw new Error("Final delivered must equal total received");
    }

    await addDoc(collection(db, "buyer_data_bank"), {
      erp_order: data.erp_order_id,
      buyer: order.buyer,
      file_no: order.file_no,
      style_no: order.style_no,
      color: order.color,
      order_qty: order.order_qty,
      total_received: totalRcv,
      total_delivered: totalDel,
      close_date: data.close_date,
      final_delivered_qty: data.final_delivered,
      wash_type: order.wash_type,
      sew_floor: order.sew_floor,
      closed_by: data.closed_by,
      is_locked: true,
      locked_at: new Date().toISOString()
    });

    await updateDoc(orderRef, {
      status: 'Closed',
      updated_at: serverTimestamp()
    });

    return true;
  },

  async getArchiveData(filters: {
    buyer?: string;
    from_date?: string;
    to_date?: string;
    file_no?: string;
    wash_type?: string;
  }) {
    let q = query(collection(db, "buyer_data_bank"), orderBy("close_date", "desc"));
    const snapshot = await getDocs(q);
    let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    if (filters.buyer) results = results.filter((r: any) => r.buyer === filters.buyer);
    if (filters.file_no) results = results.filter((r: any) => r.file_no.toLowerCase().includes(filters.file_no!.toLowerCase()));
    if (filters.wash_type) results = results.filter((r: any) => r.wash_type === filters.wash_type);
    
    return results;
  }
};
