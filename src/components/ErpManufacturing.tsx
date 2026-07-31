import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle, Package, TrendingUp, Calendar, ShieldCheck, Tag, Cpu, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "../lib/utils";

interface BOM {
  id?: string;
  item_name: string;
  raw_materials: string; // Comma separated materials with quantities
  labor_cost: number;
  material_cost: number;
  total_cost: number;
  uom: string;
  custom_values?: Record<string, any>;
  created_at?: string;
}

interface WorkOrder {
  id?: string;
  bom_id: string;
  bom_name: string;
  qty_to_produce: number;
  qty_produced: number;
  start_date: string;
  end_date: string;
  status: "Draft" | "In Progress" | "Completed" | "Cancelled";
  custom_values?: Record<string, any>;
  created_at?: string;
}

export default function ErpManufacturing() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"bom" | "wo">("bom");

  // Custom Field Meta Query
  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_custom_fields");
      if (!res.ok) return [];
      const all: any[] = await res.json();
      return all.filter(f => f.doctype === "bom");
    }
  });

  // Custom values form state
  const [customFormVals, setCustomFormVals] = useState<Record<string, any>>({});

  // BOM Form States
  const [itemName, setItemName] = useState("");
  const [rawMaterials, setRawMaterials] = useState("");
  const [laborCost, setLaborCost] = useState(0);
  const [materialCost, setMaterialCost] = useState(0);
  const [uom, setUom] = useState("Pcs");

  // Work Order Form States
  const [woBomId, setWoBomId] = useState("");
  const [woQty, setWoQty] = useState(100);
  const [woStartDate, setWoStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [woEndDate, setWoEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);

  // DB queries
  const { data: boms = [], isLoading: loadingBoms } = useQuery<BOM[]>({
    queryKey: ["boms"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_boms");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: workOrders = [], isLoading: loadingWOs } = useQuery<WorkOrder[]>({
    queryKey: ["workOrders"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_work_orders");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Mutations
  const createBomMutation = useMutation({
    mutationFn: async (bom: BOM) => {
      const res = await fetch("/api/db/erp_boms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bom)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      toast.success("BOM created successfully.");
      setItemName("");
      setRawMaterials("");
      setLaborCost(0);
      setMaterialCost(0);
      setCustomFormVals({});
    }
  });

  const createWoMutation = useMutation({
    mutationFn: async (wo: WorkOrder) => {
      const res = await fetch("/api/db/erp_work_orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wo)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      toast.success("Work Order scheduled.");
      setWoBomId("");
    }
  });

  const updateWoStatusMutation = useMutation({
    mutationFn: async ({ id, status, qtyProduced }: { id: string; status: string; qtyProduced?: number }) => {
      const payload: any = { status };
      if (qtyProduced !== undefined) payload.qty_produced = qtyProduced;
      const res = await fetch(`/api/db/erp_work_orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      toast.success("Work Order status updated.");
    }
  });

  const handleCreateBom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return toast.error("Item name is required.");
    const total_cost = Number(laborCost) + Number(materialCost);
    createBomMutation.mutate({
      item_name: itemName,
      raw_materials: rawMaterials,
      labor_cost: Number(laborCost),
      material_cost: Number(materialCost),
      total_cost,
      uom,
      custom_values: customFormVals,
      created_at: new Date().toISOString()
    });
  };

  const handleCreateWO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!woBomId) return toast.error("Select a Bill of Materials (BOM).");
    const selectedBom = boms.find(b => b.id === woBomId);
    createWoMutation.mutate({
      bom_id: woBomId,
      bom_name: selectedBom?.item_name || "Unknown Item",
      qty_to_produce: Number(woQty),
      qty_produced: 0,
      start_date: woStartDate,
      end_date: woEndDate,
      status: "Draft",
      created_at: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("bom")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "bom"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Bill of Materials (BOM)
        </button>
        <button
          onClick={() => setActiveTab("wo")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "wo"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Work Orders (Production)
        </button>
      </div>

      {activeTab === "bom" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create BOM form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={14} className="text-blue-600" /> Create Bill of Materials
            </h3>
            <form onSubmit={handleCreateBom} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Production Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Regular Slim Fit Denim Washing"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit of Measure (UOM)</label>
                <select
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Dzn">Dzn (Dozen)</option>
                  <option value="Kg">Kg</option>
                  <option value="Yds">Yards</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Raw Materials / Ingredients (with Quantities)
                </label>
                <textarea
                  value={rawMaterials}
                  onChange={(e) => setRawMaterials(e.target.value)}
                  placeholder="e.g. Wash Enzyme 200ml, Softener 50g, Pumice stone 1kg"
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Material Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialCost}
                    onChange={(e) => setMaterialCost(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Labor/Process Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields injection */}
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
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={createBomMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus size={14} />
                <span>Create BOM Formula</span>
              </button>
            </form>
          </div>

          {/* BOM list table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active BOM Formulations</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Total Formulas: {boms.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Item Name</th>
                    <th className="px-3 py-2.5">UOM</th>
                    <th className="px-3 py-2.5">Materials Summary</th>
                    <th className="px-3 py-2.5 text-right">Labor ($)</th>
                    <th className="px-3 py-2.5 text-right">Raw ($)</th>
                    <th className="px-4 py-2.5 text-right">Total Est Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingBoms ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading BOM formulations...</td></tr>
                  ) : boms.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400 italic">No Bills of Materials configured. Create one!</td></tr>
                  ) : (
                    boms.map((bom) => (
                      <tr key={bom.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {bom.item_name}
                          {bom.custom_values && Object.entries(bom.custom_values).map(([k, v]) => (
                            <div key={k} className="text-[10px] text-slate-400">
                              {k}: <span className="text-slate-600 font-mono">{String(v)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-3 py-3"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium text-[10px]">{bom.uom}</span></td>
                        <td className="px-3 py-3 text-slate-500 font-sans max-w-[180px] truncate" title={bom.raw_materials}>{bom.raw_materials || "None"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-600">${formatNumber(bom.labor_cost)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-600">${formatNumber(bom.material_cost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-600">${formatNumber(bom.total_cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Work Order form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} className="text-blue-600" /> Issue Work Order
            </h3>
            <form onSubmit={handleCreateWO} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select BOM Formula</label>
                <select
                  value={woBomId}
                  onChange={(e) => setWoBomId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Choose BOM --</option>
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>{b.item_name} (${formatNumber(b.total_cost)}/unit)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Production Qty</label>
                <input
                  type="number"
                  value={woQty}
                  onChange={(e) => setWoQty(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={woStartDate}
                    onChange={(e) => setWoStartDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Target</label>
                  <input
                    type="date"
                    value={woEndDate}
                    onChange={(e) => setWoEndDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createWoMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Schedule Work Order</span>
              </button>
            </form>
          </div>

          {/* Work Orders grid / tracker */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Work Orders & Operations Tracking</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Active Tasks: {workOrders.length}</span>
            </div>
            <div className="p-4 overflow-auto max-h-[480px] space-y-4">
              {loadingWOs ? (
                <div className="text-center py-8 text-slate-400 text-xs">Loading operations tracker...</div>
              ) : workOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No active production tasks scheduled.</div>
              ) : (
                workOrders.map((wo) => {
                  const percent = Math.min(100, Math.round(((wo.qty_produced || 0) / wo.qty_to_produce) * 100));
                  return (
                    <div key={wo.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="space-y-1.5 flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{wo.bom_name}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            wo.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                            wo.status === "In Progress" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-800"
                          }`}>
                            {wo.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans flex flex-wrap gap-x-4">
                          <span>Target: <strong className="text-slate-600">{formatNumber(wo.qty_to_produce)} units</strong></span>
                          <span>Completed: <strong className="text-slate-600">{formatNumber(wo.qty_produced || 0)}</strong></span>
                          <span>Due: <strong className="text-slate-600">{formatDate(wo.end_date)}</strong></span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className="text-right text-[10px] font-bold text-emerald-600 font-mono">{percent}% finished</div>
                      </div>

                      {/* Operations tools */}
                      <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                        {wo.status === "Draft" && (
                          <button
                            onClick={() => updateWoStatusMutation.mutate({ id: wo.id!, status: "In Progress" })}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-all"
                          >
                            Start Process
                          </button>
                        )}
                        {wo.status === "In Progress" && (
                          <>
                            <button
                              onClick={() => {
                                const addStr = prompt("Enter extra completed quantities to log:", "50");
                                if (addStr && !isNaN(Number(addStr))) {
                                  const totalPrd = (wo.qty_produced || 0) + Number(addStr);
                                  const nextStatus = totalPrd >= wo.qty_to_produce ? "Completed" : "In Progress";
                                  updateWoStatusMutation.mutate({ id: wo.id!, status: nextStatus, qtyProduced: totalPrd });
                                }
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-all"
                            >
                              Log Yield
                            </button>
                            <button
                              onClick={() => updateWoStatusMutation.mutate({ id: wo.id!, status: "Completed" })}
                              className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-all"
                            >
                              Force Complete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
