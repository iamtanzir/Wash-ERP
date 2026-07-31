import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, DollarSign, Receipt, CreditCard, TrendingUp, ShieldCheck, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "../lib/utils";

interface Invoice {
  id?: string;
  invoice_no: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  tax_rate: number;
  total_amount: number;
  status: "Paid" | "Unpaid" | "Overdue";
  custom_values?: Record<string, any>;
  created_at?: string;
}

interface JournalEntry {
  id?: string;
  account_name: string;
  account_type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  debit: number;
  credit: number;
  description: string;
  created_at?: string;
}

export default function ErpAccounts() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"invoices" | "journals">("invoices");

  // Custom Fields Meta Query
  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_custom_fields");
      if (!res.ok) return [];
      const all: any[] = await res.json();
      return all.filter(f => f.doctype === "invoice");
    }
  });

  const [customFormVals, setCustomFormVals] = useState<Record<string, any>>({});

  // Invoice Form States
  const [invNo, setInvNo] = useState("");
  const [invCustomer, setInvCustomer] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().split("T")[0]);
  const [invDueDate, setInvDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
  const [invAmount, setInvAmount] = useState(0);
  const [invTax, setInvTax] = useState(15); // 15% VAT

  // Journal form states
  const [jrAccount, setJrAccount] = useState("");
  const [jrType, setJrType] = useState<JournalEntry["account_type"]>("Revenue");
  const [jrDebit, setJrDebit] = useState(0);
  const [jrCredit, setJrCredit] = useState(0);
  const [jrDesc, setJrDesc] = useState("");

  // Queries
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["erpInvoices"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_invoices");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: journals = [], isLoading: loadingJournals } = useQuery<JournalEntry[]>({
    queryKey: ["erpJournals"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_journals");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Financial Stats summary
  const financeSummary = useMemo(() => {
    let salesTotal = 0;
    let outstandingTotal = 0;
    let paidTotal = 0;

    invoices.forEach(inv => {
      salesTotal += inv.total_amount;
      if (inv.status === "Paid") {
        paidTotal += inv.total_amount;
      } else {
        outstandingTotal += inv.total_amount;
      }
    });

    return { salesTotal, outstandingTotal, paidTotal };
  }, [invoices]);

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const res = await fetch("/api/db/erp_invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpInvoices"] });
      toast.success("Invoice saved and posted.");
      setInvNo("");
      setInvCustomer("");
      setInvAmount(0);
      setCustomFormVals({});
    }
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice["status"] }) => {
      const res = await fetch(`/api/db/erp_invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpInvoices"] });
      toast.success("Invoice payment status updated.");
    }
  });

  const createJournalMutation = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      const res = await fetch("/api/db/erp_journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpJournals"] });
      toast.success("General ledger transaction journal posted.");
      setJrAccount("");
      setJrDebit(0);
      setJrCredit(0);
      setJrDesc("");
    }
  });

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invNo.trim() || !invCustomer.trim()) return toast.error("Invoice code and Customer are required.");
    
    if (invoices.some(i => i.invoice_no.toLowerCase() === invNo.toLowerCase().trim())) {
      return toast.error("Invoice Code already exists.");
    }

    const total = Number(invAmount) + (Number(invAmount) * (Number(invTax) / 100));

    createInvoiceMutation.mutate({
      invoice_no: invNo.trim().toUpperCase(),
      customer_name: invCustomer.trim(),
      invoice_date: invDate,
      due_date: invDueDate,
      amount: Number(invAmount),
      tax_rate: Number(invTax),
      total_amount: total,
      status: "Unpaid",
      custom_values: customFormVals,
      created_at: new Date().toISOString()
    });
  };

  const handleCreateJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jrAccount.trim()) return toast.error("Account name is required.");
    if (Number(jrDebit) === 0 && Number(jrCredit) === 0) return toast.error("Please enter a valid Debit or Credit amount.");

    createJournalMutation.mutate({
      account_name: jrAccount.trim(),
      account_type: jrType,
      debit: Number(jrDebit),
      credit: Number(jrCredit),
      description: jrDesc,
      created_at: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Gross Accounts Receivable</p>
          <p className="text-3xl font-light text-blue-600 mt-1">${formatNumber(financeSummary.salesTotal)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Pending Invoices Outstanding</p>
          <p className="text-3xl font-light text-orange-600 mt-1">${formatNumber(financeSummary.outstandingTotal)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Clearing Cash Income</p>
          <p className="text-3xl font-light text-emerald-600 mt-1">${formatNumber(financeSummary.paidTotal)}</p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "invoices"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Sales & Purchase Invoices
        </button>
        <button
          onClick={() => setActiveTab("journals")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "journals"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          General Ledger Book
        </button>
      </div>

      {activeTab === "invoices" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Invoice Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Plus size={14} className="text-blue-600" /> New Account Invoice
            </h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invNo}
                    onChange={(e) => setInvNo(e.target.value)}
                    placeholder="INV-2026-001"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer / Buyer</label>
                  <input
                    type="text"
                    value={invCustomer}
                    onChange={(e) => setInvCustomer(e.target.value)}
                    placeholder="H&M Corp, Levi's"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pre-Tax Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invAmount}
                    onChange={(e) => setInvAmount(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax / VAT Rate (%)</label>
                  <input
                    type="number"
                    value={invTax}
                    onChange={(e) => setInvTax(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
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
                disabled={createInvoiceMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Save and Post Invoice</span>
              </button>
            </form>
          </div>

          {/* Invoice status lists */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Financial Invoices</h3>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">Invoices: {invoices.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Dates</th>
                    <th className="px-3 py-2.5 text-right">Pre-Tax</th>
                    <th className="px-3 py-2.5 text-right font-bold text-blue-600">Total Bill</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingInvoices ? (
                    <tr><td colSpan={7} className="text-center p-8 text-slate-400">Loading invoice registers...</td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-slate-400 italic">No invoices issued.</td></tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{inv.invoice_no}</td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-slate-800">{inv.customer_name}</span>
                          {inv.custom_values && Object.entries(inv.custom_values).map(([k, v]) => (
                            <div key={k} className="text-[10px] text-slate-400">
                              {k}: <span className="text-slate-600">{String(v)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-slate-500 font-sans">
                          Issued: {formatDate(inv.invoice_date)}<br />
                          Due: {formatDate(inv.due_date)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-500">${formatNumber(inv.amount)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-800">${formatNumber(inv.total_amount)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            inv.status === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.status !== "Paid" && (
                            <button
                              onClick={() => updateInvoiceStatusMutation.mutate({ id: inv.id!, status: "Paid" })}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded flex items-center gap-1 ml-auto"
                            >
                              <Check size={10} /> Mark Paid
                            </button>
                          )}
                        </td>
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
          {/* Post Ledger Journal Entry */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={14} className="text-blue-600" /> General Journal Voucher
            </h3>
            <form onSubmit={handleCreateJournal} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Title</label>
                <input
                  type="text"
                  value={jrAccount}
                  onChange={(e) => setJrAccount(e.target.value)}
                  placeholder="e.g. Wash Factory Chemical Store"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Category</label>
                <select
                  value={jrType}
                  onChange={(e) => setJrType(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="Asset">Asset (Cash, Warehouse Materials)</option>
                  <option value="Liability">Liability (Accounts Payable, Loans)</option>
                  <option value="Equity">Owner Equity</option>
                  <option value="Revenue">Sales Revenue</option>
                  <option value="Expense">Washing, Utilities & Wages Expense</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Debit ($)</label>
                  <input
                    type="number"
                    value={jrDebit}
                    onChange={(e) => setJrDebit(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credit ($)</label>
                  <input
                    type="number"
                    value={jrCredit}
                    onChange={(e) => setJrCredit(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ledger Narrative Memo</label>
                <input
                  type="text"
                  value={jrDesc}
                  onChange={(e) => setJrDesc(e.target.value)}
                  placeholder="e.g. Chemicals purchasing invoice #38"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createJournalMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Post Journal Transaction</span>
              </button>
            </form>
          </div>

          {/* Journals ledger book */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Posted Accounts Journal Ledger</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Total Postings: {journals.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Posting Date</th>
                    <th className="px-3 py-2.5">Account Title</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-800">Debit ($)</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-800">Credit ($)</th>
                    <th className="px-4 py-2.5">Narration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingJournals ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading General Ledger...</td></tr>
                  ) : journals.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400 italic">No transactions posted to Ledger yet.</td></tr>
                  ) : (
                    journals.map((jr) => (
                      <tr key={jr.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDate(jr.created_at || "")}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{jr.account_name}</td>
                        <td className="px-3 py-3"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium text-[10px]">{jr.account_type}</span></td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-600 font-semibold">{jr.debit > 0 ? `$${formatNumber(jr.debit)}` : "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-rose-600 font-semibold">{jr.credit > 0 ? `$${formatNumber(jr.credit)}` : "-"}</td>
                        <td className="px-4 py-3 text-slate-500 italic max-w-[150px] truncate" title={jr.description}>{jr.description || "-"}</td>
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
