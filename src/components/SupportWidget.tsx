import React, { useState } from 'react';
import { PhoneCall, ShieldCheck, X, LifeBuoy, Wrench, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const phone = "01710-110490";

  const handleCopy = () => {
    navigator.clipboard.writeText("01710110490");
    setCopied(true);
    toast.success("Phone number copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Support Button at bottom right */}
      <div className="fixed bottom-12 right-4 md:bottom-12 md:right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all border border-blue-400/30"
          title="Call for Support: 01710-110490"
        >
          <PhoneCall size={14} className="animate-pulse text-yellow-300" />
          <span className="hidden sm:inline">Support:</span>
          <span className="font-mono text-yellow-200">01710-110490</span>
        </button>
      </div>

      {/* Support Pop-up Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 relative space-y-5 my-8">
              {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <LifeBuoy size={26} className="animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">System Support & Assistance</h3>
                <p className="text-xs text-slate-500 font-medium">সিস্টেমে যেকোনো কারিগরি সমস্যায় যোগাযোগ করুন</p>
              </div>
            </div>

            {/* Contact Details Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Direct Support Hotline</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <a
                  href={`tel:${phone.replace(/-/g, '')}`}
                  className="flex items-center gap-2 text-xl font-mono font-black text-yellow-300 hover:text-yellow-200 transition-colors"
                >
                  <PhoneCall size={20} className="text-emerald-400" />
                  <span>{phone}</span>
                </a>
                <button
                  onClick={handleCopy}
                  className="p-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  title="Copy Phone Number"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>



            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Close / বন্ধ করুন
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
