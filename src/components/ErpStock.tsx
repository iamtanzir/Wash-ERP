import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Layers, RefreshCw, BarChart2, ShieldCheck, Truck, ListCollapse } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "../lib/utils";

interface ErpItem {
  id?: string;
  item_code: string;
  item_name: string;
  item_group: "Raw Material" | "Washing Chemical" | "Finished Goods" | "Trims & Accessories";
  opening_stock: number;
  valuation_rate: number;
  safety_stock: number;
  uom: string;
  custom_values?: Record<string, any>;
  created_at?: string;
}

interface StockEntry {
  id?: string;
  item_code: string;
  item_name: string;
  qty: number;
  entry_type: "Material Receipt" | "Material Issue" | "Material Transfer";
  source_warehouse?: string;
  target_warehouse?: string;
  logged_by: string;
  remarks?: string;
  created_at?: string;
}

export default function ErpStock() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"items" | "ledger">("items");

  // Custom Fields Meta Query
  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_custom_fields");
      if (!res.ok) return [];
      const all: any[] = await res.json();
      return all.filter(f => f.doctype === "item");
    }
  });

  // Custom Form Values
  const [customFormVals, setCustomFormVals] = useState<Record<string, any>>({});

  // Item Form states
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemGroup, setItemGroup] = useState<ErpItem["item_group"]>("Raw Material");
  const [openingStock, setOpeningStock] = useState(0);
  const [valuationRate, setValuationRate] = useState(0);
  const [safetyStock, setSafetyStock] = useState(10);
  const [uom, setUom] = useState("Pcs");

  // Ledger form states
  const [ledgItemCode, setLedgItemCode] = useState("");
  const [ledgQty, setLedgQty] = useState(1);
  const [ledgType, setLedgType] = useState<StockEntry["entry_type"]>("Material Receipt");
  const [ledgSource, setLedgSource] = useState("Main Store");
  const [ledgTarget, setLedgTarget] = useState("Washing Floor");
  const [ledgRemarks, setLedgRemarks] = useState("");

  // Queries
  const { data: items = [], isLoading: loadingItems } = useQuery<ErpItem[]>({
    queryKey: ["erpItems"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_items");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: ledgerEntries = [], isLoading: loadingLedger } = useQuery<StockEntry[]>({
    queryKey: ["stockLedger"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_stock_ledger");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Calculate real-time stock balances from Opening stock + Ledger transactions!
  const stockBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    items.forEach(item => {
      balances[item.item_code] = item.opening_stock;
    });

    ledgerEntries.forEach(entry => {
      const code = entry.item_code;
      if (balances[code] === undefined) balances[code] = 0;
      
      if (entry.entry_type === "Material Receipt") {
        balances[code] += entry.qty;
      } else if (entry.entry_type === "Material Issue") {
        balances[code] -= entry.qty;
      } else if (entry.entry_type === "Material Transfer") {
        // Source minus, Target plus
        // In this basic version, we calculate local warehouse balance if requested, 
        // but overall company stock level does not change in transfer unless it left the premise.
        // We simulate overall balance tracking here:
      }
    });

    return balances;
  }, [items, ledgerEntries]);

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: async (item: ErpItem) => {
      const res = await fetch("/api/db/erp_items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpItems"] });
      toast.success("Item saved to database.");
      setItemCode("");
      setItemName("");
      setOpeningStock(0);
      setValuationRate(0);
      setCustomFormVals({});
    }
  });

  const createLedgerMutation = useMutation({
    mutationFn: async (entry: StockEntry) => {
      const res = await fetch("/api/db/erp_stock_ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stockLedger"] });
      toast.success("Stock transaction ledger posted.");
      setLedgItemCode("");
      setLedgQty(1);
      setLedgRemarks("");
    }
  });

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim() || !itemName.trim()) return toast.error("Item code and name are required.");
    
    // Check duplication
    if (items.some(i => i.item_code.toLowerCase() === itemCode.toLowerCase().trim())) {
      return toast.error("Item Code already exists.");
    }

    createItemMutation.mutate({
      item_code: itemCode.trim().toUpperCase(),
      item_name: itemName.trim(),
      item_group: itemGroup,
      opening_stock: Number(openingStock),
      valuation_rate: Number(valuationRate),
      safety_stock: Number(safetyStock),
      uom,
      custom_values: customFormVals,
      created_at: new Date().toISOString()
    });
  };

  const handleCreateLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgItemCode) return toast.error("Please select an item.");
    const selectedItem = items.find(i => i.item_code === ledgItemCode);

    createLedgerMutation.mutate({
      item_code: ledgItemCode,
      item_name: selectedItem?.item_name || "Unknown Item",
      qty: Number(ledgQty),
      entry_type: ledgType,
      source_warehouse: ledgType !== "Material Receipt" ? ledgSource : undefined,
      target_warehouse: ledgType !== "Material Issue" ? ledgTarget : undefined,
      logged_by: "Admin",
      remarks: ledgRemarks,
      created_at: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("items")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "items"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Stock Items Master
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "ledger"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Warehouse Ledger Posting
        </button>
      </div>

      {activeTab === "items" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Item Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Plus size={14} className="text-blue-600" /> New Item Master Sheet
            </h3>
            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item Code / SKU</label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="e.g. CHEM-001"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item Group</label>
                  <select
                    value={itemGroup}
                    onChange={(e) => setItemGroup(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Raw Material">Raw Material</option>
                    <option value="Washing Chemical">Washing Chemical</option>
                    <option value="Finished Goods">Finished Goods</option>
                    <option value="Trims & Accessories">Trims & Accessories</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Acetic Acid (Glacial) Wash Grade"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">UOM</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltr">Litre</option>
                    <option value="Roll">Rolls</option>
                    <option value="Box">Boxes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opening Stock</label>
                  <input
                    type="number"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Safety Level</label>
                  <input
                    type="number"
                    value={safetyStock}
                    onChange={(e) => setSafetyStock(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Standard Valuation ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valuationRate}
                  onChange={(e) => setValuationRate(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              {/* Custom field meta fields */}
              {customFields.map((field: any) => (
                <div key={field.id}>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {field.label} {field.is_required && <span className="text-red-500">*</span>}
                  </label>
                  {field.fieldtype === "Select" ? (
                    <select
                      value={customFormVals[field.fieldname] || ""}
                      onChange={(e) => setCustomFormVals({ ...customFormVals, [field.fieldname]: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="">-- Choose Option --</option>
                      {field.options?.split(",").map((o: string) => (
                        <option key={o.trim()} value={o.trim()}>{o.trim()}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.fieldtype === "Int" || field.fieldtype === "Float" ? "number" : "text"}
                      value={customFormVals[field.fieldname] || ""}
                      onChange={(e) => setCustomFormVals({ ...customFormVals, [field.fieldname]: e.target.value })}
                      placeholder={field.placeholder || ""}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={createItemMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Save Stock SKU Item</span>
              </button>
            </form>
          </div>

          {/* Item status lists */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Item Inventory Stock Ledger</h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">Total SKUs: {items.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Item Code</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Item Group</th>
                    <th className="px-3 py-2.5 text-right">Opening</th>
                    <th className="px-3 py-2.5 text-right font-bold text-blue-600">Current Balance</th>
                    <th className="px-4 py-2.5 text-right">Valuation Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingItems ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading master SKU registry...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400 italic">No inventory registered in this facility.</td></tr>
                  ) : (
                    items.map((item) => {
                      const balance = stockBalances[item.item_code] !== undefined ? stockBalances[item.item_code] : item.opening_stock;
                      const isLow = balance <= item.safety_stock;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-blue-600">{item.item_code}</td>
                          <td className="px-3 py-3">
                            <span className="font-semibold text-slate-800">{item.item_name}</span>
                            {isLow && (
                              <span className="ml-2 text-[9px] bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded font-bold uppercase tracking-wide">
                                Low Stock
                              </span>
                            )}
                            {item.custom_values && Object.entries(item.custom_values).map(([k, v]) => (
                              <div key={k} className="text-[10px] text-slate-400">
                                {k}: <span className="text-slate-600">{String(v)}</span>
                              </div>
                            ))}
                          </td>
                          <td className="px-3 py-3 text-slate-500">{item.item_group}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-500">{formatNumber(item.opening_stock)} {item.uom}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-bold text-blue-700 bg-blue-50/20">{formatNumber(balance)} {item.uom}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-semibold">${formatNumber(item.valuation_rate)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post stock entry ledger */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Truck size={14} className="text-blue-600" /> Stock Ledger Posting
            </h3>
            <form onSubmit={handleCreateLedger} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Item Code</label>
                <select
                  value={ledgItemCode}
                  onChange={(e) => setLedgItemCode(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.item_code}>[{it.item_code}] {it.item_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Entry Type</label>
                <select
                  value={ledgType}
                  onChange={(e) => setLedgType(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="Material Receipt">Material Receipt (Add Stock)</option>
                  <option value="Material Issue">Material Issue (Reduce Stock)</option>
                  <option value="Material Transfer">Material Transfer (Move between warehouses)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quantity</label>
                <input
                  type="number"
                  value={ledgQty}
                  onChange={(e) => setLedgQty(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source Store</label>
                  <input
                    type="text"
                    value={ledgSource}
                    disabled={ledgType === "Material Receipt"}
                    onChange={(e) => setLedgSource(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Warehouse</label>
                  <input
                    type="text"
                    value={ledgTarget}
                    disabled={ledgType === "Material Issue"}
                    onChange={(e) => setLedgTarget(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Journal Remarks</label>
                <input
                  type="text"
                  value={ledgRemarks}
                  onChange={(e) => setLedgRemarks(e.target.value)}
                  placeholder="e.g. Received chemicals from supplier A"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={createLedgerMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Post Ledger Entry</span>
              </button>
            </form>
          </div>

          {/* Ledger history table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Posted Journal Ledger Entries</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Total Posted: {ledgerEntries.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-3 py-2.5">SKU Item</th>
                    <th className="px-3 py-2.5">Entry Type</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5">Store Routes</th>
                    <th className="px-4 py-2.5">Remarks / Ledger Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingLedger ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading audit log entries...</td></tr>
                  ) : ledgerEntries.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400 italic">No warehouse transactions recorded.</td></tr>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDate(entry.created_at || "")}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{entry.item_name} <span className="text-slate-400 text-[10px] font-mono">[{entry.item_code}]</span></td>
                        <td className="px-3 py-3">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            entry.entry_type === "Material Receipt" ? "bg-green-100 text-green-800" :
                            entry.entry_type === "Material Issue" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-800">{formatNumber(entry.qty)}</td>
                        <td className="px-3 py-3 text-slate-500 text-[10px] font-sans">
                          {entry.source_warehouse || "-"} &rarr; {entry.target_warehouse || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 italic max-w-[150px] truncate" title={entry.remarks}>{entry.remarks || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
