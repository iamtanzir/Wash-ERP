import React, { useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

export default function NewERPPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ count: number; skipped: number } | null>(null);

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
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to parse file on server");
      }

      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        // Bulk upsert into Firestore
        const batch = writeBatch(db);
        const erpCollection = collection(db, "erp_orders");

        result.data.forEach((row: any) => {
          // Use file_name + style_no as a unique key for upsert
          const docId = `${row.file_name}_${row.style_no}`.replace(/[\/\s]/g, "_");
          const docRef = doc(erpCollection, docId);
          batch.set(docRef, {
            ...row,
            uploaded_by: user?.email,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });

        await batch.commit();
        setSummary({ count: result.data.length, skipped: 0 });
        toast.success(`Successfully uploaded ${result.data.length} records`);
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NEXT ERP Plan Upload</h1>
          <p className="text-slate-500 text-sm italic">Import master ERP records via Excel (.xlsx)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
            <AlertCircle className="text-blue-600 shrink-0" size={24} />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-bold">Required Excel Header Order:</p>
              <p className="font-mono text-[10px] break-all bg-white/50 p-2 rounded">
                Buyer Name | ERP Ship Date | Job Ref / File Name | Style No / Developing Name | CPL Qty (kg) | Order Qty (pcs) | Sew Floor Item List | Type of Wash | Wash Status | P.P/ Plan | Print/ Emb Source.Ref | Remarks/ 1st TOD
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
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-500" />
          Import Guidelines
        </h4>
        <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
          <li>System uses <strong>Job Ref / File Name</strong> and <strong>Style No</strong> combined as unique key.</li>
          <li>Existing records with matching keys will be <strong>updated</strong> (Upsert).</li>
          <li>Dates should be in standard Excel date format.</li>
          <li>Numeric fields (Qty) should not contain characters other than numbers and commas.</li>
        </ul>
      </div>
    </div>
  );
}
