import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Truck, ClipboardList, TrendingUp, DollarSign, Star, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "../lib/utils";

interface RFQ {
  id?: string;
  po_number: string;
  vendor: string;
  item_desc: string;
  qty: number;
  unit_price: number;
  tax_rate: number; // e.g. 5 for 5%
  net_total: number;
  status: "Draft RFQ" | "RFQ Sent" | "PO Confirmed" | "Goods Received";
  remarks?: string;
  created_at?: string;
}

interface Vendor {
  id?: string;
  name: string;
  contact: string;
  item_supplied: string;
  rating: number; // 1-5 stars
  payment_terms: string;
  created_at?: string;
}

export default function ErpPurchase() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"rfq" | "create" | "vendors">("rfq");
  const [search, setSearch] = useState("");

  // RFQ form states
  const [vendor, setVendor] = useState("Alpha Chemical Suppliers Ltd");
  const [itemDesc, setItemDesc] = useState("");
  const [qty, setQty] = useState(100);
  const [unitPrice, setUnitPrice] = useState(4.5);
  const [taxRate, setTaxRate] = useState(5);
  const [remarks, setRemarks] = useState("");

  // Vendor form states
  const [vName, setVName] = useState("");
  const [vContact, setVContact] = useState("");
  const [vItem, setVItem] = useState("Pumice Stones");
  const [vRating, setVRating] = useState(4);
  const [vTerms, setVTerms] = useState("Net 30");

  // Fetch RFQs
  const { data: rfqs = [], isLoading: loadingRFQs } = useQuery<RFQ[]>({
    queryKey: ["erpPurchaseRFQs"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_purchase_rfqs");
      if (!res.ok) return [];
      const data = await res.json();
      
      // Seed if empty
      if (data.length === 0) {
        const seedRFQs: RFQ[] = [
          { po_number: "PUR-2026-0001", vendor: "Alpha Chemical Suppliers Ltd", item_desc: "Wash Enzyme (Cellulase Extra Concentrated)", qty: 500, unit_price: 12.5, tax_rate: 5, net_total: 6562.5, status: "PO Confirmed", remarks: "Crucial for Levi's belly washer enzyme washes scheduled next week.", created_at: new Date().toISOString() },
          { po_number: "PUR-2026-0002", vendor: "EcoDye Resins Corp", item_desc: "Silicone Softener Emulsion", qty: 300, unit_price: 8.2, tax_rate: 5, net_total: 2583.0, status: "Draft RFQ", remarks: "Quotation requested for Zara premium finish tests.", created_at: new Date().toISOString() },
          { po_number: "PUR-2026-0003", vendor: "Indus Pumice Mining", item_desc: "High Porosity Washing Pumice Stones (Grade A)", qty: 2000, unit_price: 1.1, tax_rate: 0, net_total: 2200.0, status: "Goods Received", remarks: "Stock delivered and logged directly into Stock Room 3.", created_at: new Date().toISOString() },
        ];
        
        await fetch("/api/db/batch/erp_purchase_rfqs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: seedRFQs })
        });
        return seedRFQs;
      }
      return data;
    }
  });

  // Fetch Vendors
  const { data: vendors = [], isLoading: loadingVendors } = useQuery<Vendor[]>({
    queryKey: ["erpPurchaseVendors"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_purchase_vendors");
      if (!res.ok) return [];
      const data = await res.json();
      
      // Seed if empty
      if (data.length === 0) {
        const seedVendors: Vendor[] = [
          { name: "Alpha Chemical Suppliers Ltd", contact: "sales@alphachem.co", item_supplied: "Washing Chemicals", rating: 5, payment_terms: "Net 30", created_at: new Date().toISOString() },
          { name: "EcoDye Resins Corp", contact: "logistics@ecodye.com", item_supplied: "Organic Resins & Pigments", rating: 4, payment_terms: "Net 45", created_at: new Date().toISOString() },
          { name: "Indus Pumice Mining", contact: "pumice@indusmines.net", item_supplied: "Pumice Stones & Buffers", rating: 4, payment_terms: "Cash on Delivery", created_at: new Date().toISOString() },
        ];
        
        await fetch("/api/db/batch/erp_purchase_vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: seedVendors })
        });
        return seedVendors;
      }
      return data;
    }
  });

  // Mutations
  const createRFQMutation = useMutation({
    mutationFn: async (rfq: RFQ) => {
      const res = await fetch("/api/db/erp_purchase_rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rfq)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpPurchaseRFQs"] });
      toast.success("Purchase RFQ posted.");
      setItemDesc("");
      setQty(100);
      setUnitPrice(4.5);
      setActiveTab("rfq");
    }
  });

  const createVendorMutation = useMutation({
    mutationFn: async (v: Vendor) => {
      const res = await fetch("/api/db/erp_purchase_vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpPurchaseVendors"] });
      toast.success("Vendor registry created.");
      setVName("");
      setVContact("");
    }
  });

  const updateRFQStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RFQ["status"] }) => {
      const res = await fetch(`/api/db/erp_purchase_rfqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpPurchaseRFQs"] });
      toast.success("RFQ/PO status updated.");
    }
  });

  const handleCreateRFQ = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDesc.trim()) return toast.error("Please enter item description.");
    
    const subtotal = Number(qty) * Number(unitPrice);
    const taxAmt = subtotal * (Number(taxRate) / 100);
    const net_total = subtotal + taxAmt;
    
    const poNum = `PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    createRFQMutation.mutate({
      po_number: poNum,
      vendor,
      item_desc: itemDesc.trim(),
      qty: Number(qty),
      unit_price: Number(unitPrice),
      tax_rate: Number(taxRate),
      net_total,
      status: "Draft RFQ",
      remarks: remarks.trim() || undefined,
      created_at: new Date().toISOString()
    });
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return toast.error("Vendor Name is required.");
    createVendorMutation.mutate({
      name: vName.trim(),
      contact: vContact.trim(),
      item_supplied: vItem,
      rating: Number(vRating),
      payment_terms: vTerms,
      created_at: new Date().toISOString()
    });
  };

  const filteredRFQs = useMemo(() => {
    if (!search.trim()) return rfqs;
    const q = search.toLowerCase();
    return rfqs.filter(r => 
      r.po_number.toLowerCase().includes(q) || 
      r.vendor.toLowerCase().includes(q) || 
      r.item_desc.toLowerCase().includes(q)
    );
  }, [rfqs, search]);

  const purchaseTotals = useMemo(() => {
    let rawTotal = 0;
    let pendingCount = 0;
    let confirmedCount = 0;

    filteredRFQs.forEach(r => {
      rawTotal += r.net_total;
      if (r.status === "Draft RFQ" || r.status === "RFQ Sent") pendingCount++;
      if (r.status === "PO Confirmed") confirmedCount++;
    });

    return {
      rawTotal,
      pendingCount,
      confirmedCount
    };
  }, [filteredRFQs]);

  return (
    <div className="space-y-6">
      {/* Tab select */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab("rfq")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "rfq"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quotation requests & PO
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "create"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            New RFQ sheet
          </button>
          <button
            onClick={() => setActiveTab("vendors")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "vendors"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Vendor Registries
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full mb-1">
          <ShoppingCart size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, Vendor, Item..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-lg border border-slate-200 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {activeTab === "rfq" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RFQ / PO list table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Purchase Quotations Ledger</h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Total RFQs: {filteredRFQs.length}</span>
            </div>
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">PO Ref</th>
                    <th className="px-3 py-2.5">Supplier / Vendor</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right font-bold text-blue-600">Total (Inc Tax)</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingRFQs ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading purchase ledger...</td></tr>
                  ) : filteredRFQs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400 italic">No purchase orders found.</td></tr>
                  ) : (
                    filteredRFQs.map((r, rIdx) => (
                      <tr key={r.id || `purchase-rfq-${r.po_number}-${rIdx}`} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">
                          {r.po_number}
                          {r.remarks && <div className="text-[10px] text-slate-400 font-normal truncate max-w-xs">{r.remarks}</div>}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{r.vendor}</td>
                        <td className="px-3 py-3 text-slate-500 font-sans max-w-[150px] truncate" title={r.item_desc}>{r.item_desc}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatNumber(r.qty)} units</td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-600">${formatNumber(r.net_total)}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              r.status === "Goods Received" ? "bg-emerald-100 text-emerald-800" :
                              r.status === "PO Confirmed" ? "bg-blue-100 text-blue-800" :
                              r.status === "RFQ Sent" ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-700"
                            }`}>
                              {r.status}
                            </span>
                            
                            {/* Quick state transitions */}
                            <div className="flex gap-1.5 mt-1">
                              {r.status === "Draft RFQ" && (
                                <button
                                  onClick={() => updateRFQStatusMutation.mutate({ id: r.id!, status: "RFQ Sent" })}
                                  className="text-[8px] bg-slate-800 text-slate-200 px-1 py-0.5 rounded"
                                >
                                  Send RFQ
                                </button>
                              )}
                              {r.status === "RFQ Sent" && (
                                <button
                                  onClick={() => updateRFQStatusMutation.mutate({ id: r.id!, status: "PO Confirmed" })}
                                  className="text-[8px] bg-blue-600 text-white px-1 py-0.5 rounded"
                                >
                                  Confirm PO
                                </button>
                              )}
                              {r.status === "PO Confirmed" && (
                                <button
                                  onClick={() => updateRFQStatusMutation.mutate({ id: r.id!, status: "Goods Received" })}
                                  className="text-[8px] bg-emerald-600 text-white px-1 py-0.5 rounded flex items-center gap-0.5"
                                >
                                  <CheckCircle size={8} /> Receive Goods
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 font-sans">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-blue-600" /> Procurement KPIs
              </h3>
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Total Procurement Budget</p>
                  <p className="text-xl font-black text-slate-800 font-mono">${formatNumber(purchaseTotals.rawTotal)}</p>
                </div>
                <DollarSign className="text-blue-500" size={20} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg">
                  <p className="text-[9px] font-bold text-sky-400 uppercase">RFQ Stage</p>
                  <p className="text-base font-black text-sky-700 font-mono">{purchaseTotals.pendingCount} pending</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-[9px] font-bold text-emerald-500 uppercase">PO Stage</p>
                  <p className="text-base font-black text-emerald-700 font-mono">{purchaseTotals.confirmedCount} active</p>
                </div>
              </div>
            </div>

            {/* Procurement Policy */}
            <div className="bg-slate-900 text-slate-200 p-5 rounded-xl border border-slate-800 shadow-xl space-y-3.5 text-xs font-sans">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                🔒 Odoo Sourcing Rules
              </h4>
              <p className="leading-relaxed text-slate-300">
                Purchase Order values represent committed raw materials (chemicals, dyes, pumice, packaging). Upon receiving, materials are automatically appended to the <strong>SKU Stock Ledger</strong> balances in the warehouse.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === "create" ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardList size={14} className="text-blue-600" /> New Request for Quotation (RFQ)
          </h3>

          <form onSubmit={handleCreateRFQ} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Supplier *</label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
              >
                {vendors.map((v, vIdx) => (
                  <option key={v.id || `vendor-opt-${vIdx}`} value={v.name}>{v.name} ({v.payment_terms})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Raw Material Description / SKU *</label>
              <input
                type="text"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="e.g. Acetic Acid 99% Pure, Drum Lot 20 Pcs"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purchase Qty</label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax rate (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sourcing remarks / instructions</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Quality certificates, safety parameters..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={14} />
              <span>Post RFQ Draft Sheet</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Vendor registry */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" /> Add Partner Vendor
            </h3>
            <form onSubmit={handleCreateVendor} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier Company Name *</label>
                <input
                  type="text"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Sourcing Asia Chemicals"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Email/Tel</label>
                <input
                  type="text"
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                  placeholder="procure@vendor.com"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplied Group</label>
                  <select
                    value={vItem}
                    onChange={(e) => setVItem(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="Washing Chemicals">Washing Chemicals</option>
                    <option value="Pumice Stones">Pumice Stones</option>
                    <option value="Trims & Accessories">Trims & Accessories</option>
                    <option value="Dyes & Resins">Dyes & Resins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Terms</label>
                  <select
                    value={vTerms}
                    onChange={(e) => setVTerms(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    <option value="Advanced 100%">Advanced 100%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reliability Rating (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={vRating}
                  onChange={(e) => setVRating(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={14} />
                <span>Save Vendor Profile</span>
              </button>
            </form>
          </div>

          {/* Vendors list table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Partner Vendor Index</h3>
            </div>
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Vendor Name</th>
                    <th className="px-3 py-2.5">Contact Detail</th>
                    <th className="px-3 py-2.5">Category Supplied</th>
                    <th className="px-3 py-2.5">Terms</th>
                    <th className="px-4 py-2.5 text-right">Vendor Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {vendors.map((v, vIdx) => (
                    <tr key={v.id || `vendor-row-${vIdx}`} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{v.name}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{v.contact || "No Email"}</td>
                      <td className="px-3 py-3 text-slate-500">{v.item_supplied}</td>
                      <td className="px-3 py-3"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold text-[9px]">{v.payment_terms}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5 text-amber-500 font-bold font-mono">
                          {Array.from({ length: v.rating }).map((_, i) => (
                            <Star key={i} size={11} fill="currentColor" />
                          ))}
                          <span className="ml-1 text-slate-700 font-bold text-xs">{v.rating}.0</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
