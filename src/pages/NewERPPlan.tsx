import React, { useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";
import { useQuery } from '@tanstack/react-query';
import { formatNumber, formatDate } from '../lib/utils';

export default function NewERPPlan() {
  const navigate = useNavigate();
  const { user, isEditor } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ count: number; skipped: number } | null>(null);

  const { data: activeOrders, isLoading: loadingOrders, refetch } = useQuery({
    queryKey: ['erpPlans'],
    queryFn: () => api.getActiveOrders()
  });

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Buyer Name", "ERP Ship Date", "Job Ref / File Name", "Style No / Developing Name", "CPL Qty (kg)", "Order Qty (pcs)", "Sew Floor", "Item List", "Type of Wash", "Wash Status", "P.P/ Plan", "Print/ Emb", "Source.Ref", "Remarks/ 1st TOD"],
      ["Example Buyer", "2024-05-10", "F-12345", "STL-99", "500", "12000", "Floor-A", "74-202", "Enzyme Wash", "Pending", "Sample Plan", "Print/Emb Details", "Source Reference", "Sample Remark"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "ERP_Upload_Template.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSummary(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/erp/upload", {
        method: "POST",
        headers: {
          "Accept": "application/json"
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = "Failed to parse file on server";
        try {
           const errJson = await response.json();
           if (errJson.error) errorMsg = errJson.error;
        } catch (e) {
           errorMsg = `Server error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error(`Server returned an invalid response (not JSON). Please ensure your file size is small and the template matches perfectly. (Status: ${response.status})`);
      }
      
      if (result.success && result.data.length > 0) {
        // Bulk upsert into DB via our proxy
        const operations = result.data.map((row: any) => {
          const docId = `${row.file_no}_${row.style_no}`.replace(/[\/\s]/g, "_");
          return {
            id: docId,
            data: {
              ...row,
              uploaded_by: user?.username,
              updated_at: new Date().toISOString()
            }
          };
        });

        await api.batchSetOrders(operations);
        setSummary({ count: result.data.length, skipped: 0 });
        toast.success(`Successfully uploaded ${result.data.length} records`);
        refetch();
      } else {
        toast.info("No valid rows found in Excel sheet");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sortedOrders = activeOrders ? [...activeOrders].sort((a,b) => new Date(a.erp_date || '').getTime() - new Date(b.erp_date || '').getTime()) : [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NEXT ERP Plan</h1>
            <p className="text-slate-500 text-sm italic">Import master ERP records via Excel (.xlsx) and view plans</p>
          </div>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors border border-slate-300"
        >
          <Download size={16} />
          <span>Download Template</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
            <AlertCircle className="text-blue-600 shrink-0" size={24} />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-bold">Required Excel Header Order:</p>
              <p className="font-mono text-[10px] break-all bg-white/50 p-2 rounded">
                Buyer Name | ERP Ship Date | Job Ref / File Name | Style No / Developing Name | CPL Qty (kg) | Order Qty (pcs) | Sew Floor | Item List | Type of Wash | Wash Status | P.P/ Plan | Print/ Emb | Source.Ref | Remarks/ 1st TOD
              </p>
            </div>
          </div>

          <div 
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${
              file ? "border-green-400 bg-green-50/30" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
            }`}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input 
              id="file-upload"
              type="file" 
              className="hidden" 
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet size={48} className="text-green-600" />
                <p className="font-bold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-2 text-xs text-red-500 hover:underline font-bold"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900">Click to upload or drag and drop</p>
                  <p className="text-sm text-slate-500">Excel files only (.xlsx, .xls)</p>
                </div>
              </div>
            )}
          </div>

          {summary && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-green-800">
                <CheckCircle2 size={24} />
                <div>
                  <p className="font-bold">Upload Summary</p>
                  <p className="text-sm">Processed {summary.count} rows successfully.</p>
                </div>
              </div>
              <button 
                onClick={() => navigate("/")}
                className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
              >
                View Dashboard
              </button>
            </div>
          )}

          <div className="flex justify-end pt-4">
            {!isEditor ? (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg text-xs font-bold border border-amber-100">
                <AlertCircle size={14} />
                READ-ONLY: Upload is restricted for Viewer role.
              </div>
            ) : (
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Import ERP Plan"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ERP Plan Table Display */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase">NEXT ERP Plan List</h3>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-max text-xs">
            <thead className="bg-[#f0e68c] sticky top-0 z-10 border-b border-yellow-300">
              <tr>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Buyer</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">ERP Date</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Job Ref</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Style No</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold text-right">CPL Qty (kg)</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold text-right">Order Qty (pcs)</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Sew Floor</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Item List</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Type of Wash</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">Wash Status</th>
                <th className="px-3 py-3 border-r border-[#d8cf7e] text-slate-800 font-bold">P.P/ Plan</th>
                <th className="px-3 py-3 text-red-600 font-bold">Remarks/ 1st TOD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loadingOrders ? (
                <tr><td colSpan={12} className="px-6 py-12 text-center text-slate-500 italic">Loading ERP Plans...</td></tr>
              ) : sortedOrders.length === 0 ? (
                <tr><td colSpan={12} className="px-6 py-12 text-center text-slate-500 italic">No ERP Plans found. Import a plan to see it here.</td></tr>
              ) : (
                sortedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50/50">
                    <td className="px-3 py-2 border-r border-slate-200 font-medium">{order.buyer}</td>
                    <td className="px-3 py-2 border-r border-slate-200">{order.erp_date ? formatDate(order.erp_date) : '-'}</td>
                    <td className="px-3 py-2 border-r border-slate-200 font-mono text-blue-600">{order.file_no}</td>
                    <td className="px-3 py-2 border-r border-slate-200">{order.style_no}</td>
                    <td className="px-3 py-2 border-r border-slate-200 text-right tabular-nums">{order.cpl_qty_kg ? formatNumber(order.cpl_qty_kg) : '-'}</td>
                    <td className="px-3 py-2 border-r border-slate-200 text-right tabular-nums">{formatNumber(order.order_qty)}</td>
                    <td className="px-3 py-2 border-r border-slate-200 text-center">{order.sew_floor}</td>
                    <td className="px-3 py-2 border-r border-slate-200">{order.item || '-'}</td>
                    <td className="px-3 py-2 border-r border-slate-200">{order.wash_type}</td>
                    <td className="px-3 py-2 border-r border-slate-200 text-center">{order.status}</td>
                    <td className="px-3 py-2 border-r border-slate-200">{order.plan || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">{order.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
