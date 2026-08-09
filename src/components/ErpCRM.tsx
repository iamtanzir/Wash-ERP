import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, TrendingUp, DollarSign, Award, ArrowRight, UserCheck, BarChart3, Search, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "../lib/utils";

interface Lead {
  id?: string;
  title: string;
  customer: string;
  expected_revenue: number;
  probability: number; // Percentage
  stage: "New" | "Qualified" | "Proposition" | "Won";
  phone?: string;
  email?: string;
  notes?: string;
  created_at?: string;
}

export default function ErpCRM() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"kanban" | "create" | "stats">("kanban");
  const [search, setSearch] = useState("");

  // Form States
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [expRevenue, setExpRevenue] = useState<number>(5000);
  const [probability, setProbability] = useState<number>(30);
  const [stage, setStage] = useState<Lead["stage"]>("New");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Generic DB query
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["erpCRMLeads"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_crm_leads");
      if (!res.ok) return [];
      const data = await res.json();
      
      // If DB is empty, provide high-quality default Odoo-like open-source seed data
      if (data.length === 0) {
        const seedLeads: Lead[] = [
          { title: "H&M Denim Spring Batch Wash Contract", customer: "H&M Bangladesh", expected_revenue: 125000, probability: 70, stage: "Qualified", email: "procure@hm.com", phone: "+8801711223344", created_at: new Date().toISOString() },
          { title: "Zara Premium Wash & Eco-Dye Order", customer: "Zara Spain Group", expected_revenue: 85000, probability: 40, stage: "New", email: "lead@zara.es", phone: "+34912345678", created_at: new Date().toISOString() },
          { title: "Levi's Belly Washer Capacity Blockout", customer: "Levi Strauss Asia", expected_revenue: 210000, probability: 90, stage: "Proposition", email: "production@levis.com", phone: "+180053847", created_at: new Date().toISOString() },
          { title: "Uniqlo Desizing & Softener Trial Run", customer: "Uniqlo Japan Co.", expected_revenue: 35000, probability: 100, stage: "Won", email: "trial@uniqlo.jp", phone: "+8131234567", created_at: new Date().toISOString() },
        ];
        
        // Post seeds asynchronously so they exist next time
        await fetch("/api/db/batch/erp_crm_leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: seedLeads })
        });
        return seedLeads;
      }
      return data;
    }
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      const res = await fetch("/api/db/erp_crm_leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpCRMLeads"] });
      toast.success("Odoo CRM Lead Opportunity posted successfully.");
      setTitle("");
      setCustomer("");
      setExpRevenue(5000);
      setProbability(30);
      setPhone("");
      setEmail("");
      setNotes("");
      setActiveTab("kanban");
    }
  });

  const updateLeadStageMutation = useMutation({
    mutationFn: async ({ id, nextStage, nextProb }: { id: string; nextStage: Lead["stage"]; nextProb?: number }) => {
      const payload: any = { stage: nextStage };
      if (nextProb !== undefined) payload.probability = nextProb;
      const res = await fetch(`/api/db/erp_crm_leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpCRMLeads"] });
      toast.success("CRM stage updated.");
    }
  });

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !customer.trim()) {
      return toast.error("Lead Opportunity Title and Customer are required.");
    }
    createLeadMutation.mutate({
      title: title.trim(),
      customer: customer.trim(),
      expected_revenue: Number(expRevenue),
      probability: Number(probability),
      stage,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      created_at: new Date().toISOString()
    });
  };

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l => 
      l.title.toLowerCase().includes(q) || 
      l.customer.toLowerCase().includes(q) || 
      (l.notes && l.notes.toLowerCase().includes(q))
    );
  }, [leads, search]);

  // Statistics calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let weightedRevenue = 0; // expected_revenue * probability / 100
    let wonCount = 0;
    let wonValue = 0;
    
    filteredLeads.forEach(l => {
      totalRevenue += l.expected_revenue;
      weightedRevenue += (l.expected_revenue * l.probability) / 100;
      if (l.stage === "Won") {
        wonCount++;
        wonValue += l.expected_revenue;
      }
    });

    const winRate = filteredLeads.length > 0 ? Math.round((wonCount / filteredLeads.length) * 100) : 0;

    return {
      totalRevenue,
      weightedRevenue,
      winRate,
      wonValue,
      totalCount: filteredLeads.length
    };
  }, [filteredLeads]);

  // Lead Kanban Stages
  const stages: Lead["stage"][] = ["New", "Qualified", "Proposition", "Won"];

  const stageColorMap = {
    New: "border-sky-400 bg-sky-50/50 text-sky-800",
    Qualified: "border-amber-400 bg-amber-50/50 text-amber-800",
    Proposition: "border-indigo-400 bg-indigo-50/50 text-indigo-800",
    Won: "border-emerald-400 bg-emerald-50/50 text-emerald-800"
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab("kanban")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "kanban"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Pipeline Kanban
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "create"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Create Opportunity
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "stats"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Analytics & Sales Funnel
          </button>
        </div>

        {/* Global Pipeline Search */}
        <div className="relative max-w-xs w-full mb-1">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads or customers..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>
      </div>

      {activeTab === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full items-start">
          {stages.map((stg) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stg);
            const stageSum = stageLeads.reduce((acc, curr) => acc + curr.expected_revenue, 0);

            return (
              <div key={stg} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[600px]">
                {/* Stage Header */}
                <div className={`p-3 border-b-2 ${stageColorMap[stg]} flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs uppercase tracking-wider">{stg}</span>
                    <span className="bg-white/80 text-[10px] px-1.5 py-0.2 rounded font-black text-slate-700">
                      {stageLeads.length}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold">${formatNumber(stageSum)}</span>
                </div>

                {/* Stage Cards */}
                <div className="p-3 overflow-y-auto space-y-2.5 max-h-[500px]">
                  {isLoading ? (
                    <div className="text-center py-6 text-slate-400 text-[10px]">Loading Pipeline...</div>
                  ) : stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-[11px] italic">No active opportunities</div>
                  ) : (
                    stageLeads.map((lead) => {
                      const weighted = (lead.expected_revenue * lead.probability) / 100;
                      return (
                        <div key={lead.id} className="bg-white p-3 rounded-lg border border-slate-200 hover:shadow-md transition-all group">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase">{lead.customer}</span>
                            <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                              {lead.title}
                            </h4>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 text-[10px] text-slate-500 font-medium">
                            <div>
                              <p>Expected Rev</p>
                              <p className="font-mono font-bold text-slate-800">${formatNumber(lead.expected_revenue)}</p>
                            </div>
                            <div className="text-right">
                              <p>Probability ({lead.probability}%)</p>
                              <p className="font-mono font-bold text-emerald-600">${formatNumber(weighted)}</p>
                            </div>
                          </div>

                          {/* Quick progress transitions */}
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                            {lead.phone || lead.email ? (
                              <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">
                                {lead.email || lead.phone}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-300 italic">No contact logged</span>
                            )}

                            <div className="flex items-center gap-1 shrink-0">
                              {stg !== "Won" && (
                                <button
                                  onClick={() => {
                                    const nextStg = stg === "New" ? "Qualified" : stg === "Qualified" ? "Proposition" : "Won";
                                    const nextProb = nextStg === "Won" ? 100 : lead.probability + 20;
                                    updateLeadStageMutation.mutate({ id: lead.id!, nextStage: nextStg, nextProb });
                                  }}
                                  className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-50 rounded transition-colors"
                                  title="Advance Stage"
                                >
                                  <ArrowRight size={12} />
                                </button>
                              )}
                              {stg !== "New" && (
                                <button
                                  onClick={() => {
                                    const prevStg = stg === "Won" ? "Proposition" : stg === "Proposition" ? "Qualified" : "New";
                                    const nextProb = Math.max(10, lead.probability - 25);
                                    updateLeadStageMutation.mutate({ id: lead.id!, nextStage: prevStg, nextProb });
                                  }}
                                  className="text-[9px] text-slate-300 hover:text-slate-600 font-bold px-1 py-0.5"
                                  title="Move Back"
                                >
                                  Back
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === "create" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Lead Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban size={14} className="text-blue-600" /> Log CRM Opportunity
            </h3>
            <form onSubmit={handleCreateLead} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opportunity / Deal Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Autumn Wash & Finish Contract 20K Pcs"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer / Buyer *</label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="e.g. H&M Sweden, C&A Group"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expected Revenue ($)</label>
                  <input
                    type="number"
                    value={expRevenue}
                    onChange={(e) => setExpRevenue(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Win Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={probability}
                    onChange={(e) => setProbability(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="buyer@brand.com"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1700..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stage Location</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="New">New (Incoming/Untriaged)</option>
                  <option value="Qualified">Qualified (Confirmed interest)</option>
                  <option value="Proposition">Proposition (Offer sent)</option>
                  <option value="Won">Won (Deal Closed/Contractual)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Internal Log Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details about raw material sourcing, dye recipes, lead times, or shipment risks..."
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={createLeadMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Save Lead to Pipeline</span>
              </button>
            </form>
          </div>

          {/* Guidelines / Tips Column */}
          <div className="lg:col-span-2 bg-slate-900 text-slate-100 p-6 rounded-xl space-y-4 border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              👑 Open Source Odoo CRM Standards
            </h3>
            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <p>
                In standard Odoo ERP, CRM leads are treated as dynamic entities that flow down a structured sales funnel:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-white">New Stage</strong>: Cold inbound orders or initial wash/dye sample requests awaiting review.
                </li>
                <li>
                  <strong className="text-white">Qualified Stage</strong>: Garments patterns, pricing, or fabrics test parameters validated by laboratory R&D staff.
                </li>
                <li>
                  <strong className="text-white">Proposition Stage</strong>: Chemical recipe codes, liquor ratio estimations, and work schedule layouts submitted to the buyer.
                </li>
                <li>
                  <strong className="text-white">Won Stage</strong>: Purchase agreements sealed, whitelisted as active in the Next ERP Plan and sent straight to operational schedules!
                </li>
              </ul>
              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 text-slate-400 italic">
                Pro-Tip: Expected Revenue and Win Probability are combined mathematically to compute weighted pipelines, letting managers allocate factory capacity accurately.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CRM Analytics Indicators */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-600" /> Pipeline KPIs
            </h3>

            <div className="space-y-4 font-sans">
              <div className="p-3.5 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Total Funnel Deals</p>
                  <p className="text-xl font-black text-blue-700">{stats.totalCount} active</p>
                </div>
                <Award className="text-blue-500" size={24} />
              </div>

              <div className="p-3.5 bg-sky-50/50 rounded-lg border border-sky-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Gross Pipeline Value</p>
                  <p className="text-xl font-black text-slate-800 font-mono">${formatNumber(stats.totalRevenue)}</p>
                </div>
                <DollarSign className="text-sky-500" size={24} />
              </div>

              <div className="p-3.5 bg-emerald-50/50 rounded-lg border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Projected/Weighted Pipeline</p>
                  <p className="text-xl font-black text-emerald-700 font-mono">${formatNumber(stats.weightedRevenue)}</p>
                </div>
                <TrendingUp className="text-emerald-500" size={24} />
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-lg border border-amber-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Lead Win Rate</p>
                  <p className="text-xl font-black text-amber-700">{stats.winRate}%</p>
                </div>
                <UserCheck className="text-amber-500" size={24} />
              </div>
            </div>
          </div>

          {/* Funnel distribution */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Opportunity Sourcing Ledger</h3>
            </div>
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Lead / Opportunity</th>
                    <th className="px-3 py-2.5">Buyer</th>
                    <th className="px-3 py-2.5">Stage</th>
                    <th className="px-3 py-2.5 text-right">Raw Deal Value</th>
                    <th className="px-4 py-2.5 text-right font-bold text-emerald-600">Expected (Weighted)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {filteredLeads.map((l) => {
                    const weighted = (l.expected_revenue * l.probability) / 100;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {l.title}
                          {l.notes && <div className="text-[10px] font-normal text-slate-400 truncate max-w-sm" title={l.notes}>{l.notes}</div>}
                        </td>
                        <td className="px-3 py-3 text-slate-500 font-bold uppercase">{l.customer}</td>
                        <td className="px-3 py-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${stageColorMap[l.stage]}`}>
                            {l.stage}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-500">${formatNumber(l.expected_revenue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-600 bg-emerald-50/10">${formatNumber(weighted)} <span className="text-[9px] text-slate-400 font-normal">({l.probability}%)</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
