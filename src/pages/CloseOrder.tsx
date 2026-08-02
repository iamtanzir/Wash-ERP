import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Order, DailyLog as DBLog } from '../lib/api';
import { formatNumber } from '../lib/utils';
import { toast } from 'sonner';
import { CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function CloseOrder() {
  const queryClient = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderLogs, setOrderLogs] = useState<DBLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [finalDelivered, setFinalDelivered] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: activeOrders, isLoading } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.getActiveOrders()
  });

  const totalRcv = orderLogs.reduce((sum, log) => sum + (log.received_qty || 0), 0);
  const totalDel = orderLogs.reduce((sum, log) => sum + (log.delivered_qty || 0), 0);
  const isFinalDeliveredMatch = parseInt(finalDelivered) === totalRcv;

  const handleOpenModal = async (order: Order) => {
    try {
      const logs = await api.getLogsForOrder(order.id);
      setOrderLogs(logs);
      setSelectedOrder(order);
      const calculatedTotalRcv = logs.reduce((sum, log) => sum + (log.received_qty || 0), 0);
      setFinalDelivered(calculatedTotalRcv.toString());
      setConfirmed(false);
      setIsModalOpen(true);
    } catch (err) {
      toast.error("Failed to fetch order logs");
    }
  };

  const closeMutation = useMutation({
    mutationFn: (data: any) => api.closeERPOrder(data),
    onSuccess: () => {
      toast.success('Order closed and archived successfully');
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      setIsModalOpen(false);
      setSelectedOrder(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to close order');
    }
  });

  const handleConfirmClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    closeMutation.mutate({
      erp_order_id: selectedOrder.id,
      close_date: closeDate,
      final_delivered: parseInt(finalDelivered),
      closed_by: "planning_head",
      confirmed
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 hidden">Close ERP Orders</h1>
      <p className="text-slate-500 text-sm italic">Select an active order to finalize, verify quantities, and lock it to the Data Bank.</p>

      <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[420px]">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase">Ready for Closure</h3>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">File No</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buyer</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Style / Color</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Order Qty</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {isLoading && <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">Loading active orders...</td></tr>}
                {activeOrders?.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">All caught up! No active orders to close.</td></tr>
                )}
                {activeOrders?.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 text-blue-600 font-mono">{order.file_no}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{order.buyer}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-500">{order.style_no}</div>
                      {order.color && <div className="text-xs text-slate-400 mt-0.5">{order.color}</div>}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">{formatNumber(order.order_qty)}</td>
                    <td className="px-6 py-4 text-center">
                     <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
                      order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'Running' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'Pending Closure' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(isEditor || isAdmin) ? (
                        <button
                          onClick={() => handleOpenModal(order)}
                          className="text-red-600 font-semibold text-[10px] uppercase tracking-wider hover:underline"
                        >
                          Close File
                        </button>
                      ) : (
                        <span className="text-slate-300 font-semibold text-[10px] uppercase tracking-wider cursor-not-allowed">
                          Read Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
          <form onSubmit={handleConfirmClose} className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-800" />
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide text-sm">Confirm ERP File Close</h2>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-900 space-y-2 font-mono">
                <p><span className="font-semibold uppercase text-[10px] tracking-wider text-blue-700">File No:</span> {selectedOrder.file_no} <span className="font-sans italic text-slate-600">({selectedOrder.buyer})</span></p>
                <p><span className="font-semibold uppercase text-[10px] tracking-wider text-blue-700">Style / Color:</span> <span className="font-sans text-slate-700">{selectedOrder.style_no} {selectedOrder.color ? ` / ${selectedOrder.color}` : ''}</span></p>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-100/50">
                  <p><span className="font-semibold uppercase text-[10px] tracking-wider text-blue-700 block">Order Qty</span> {formatNumber(selectedOrder.order_qty)} pcs</p>
                  <div></div>
                  <p><span className="font-semibold uppercase text-[10px] tracking-wider text-blue-700 block">Total Rcv</span> {formatNumber(totalRcv)} pcs</p>
                  <p><span className="font-semibold uppercase text-[10px] tracking-wider text-blue-700 block">Total Del</span> {formatNumber(totalDel)} pcs</p>
                </div>
              </div>

              {totalDel < selectedOrder.order_qty && (
                <div className="flex items-start gap-2 bg-red-50 text-red-800 p-3 rounded-lg text-xs font-mono border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Warning: Total delivered ({formatNumber(totalDel)}) is strictly less than order quantity ({formatNumber(selectedOrder.order_qty)}). You cannot close this yet if validation is strict.</p>
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer group bg-slate-50 p-3 rounded-lg border border-slate-200">
                <input 
                  type="checkbox" 
                  checked={confirmed} 
                  onChange={e => setConfirmed(e.target.checked)} 
                  className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm text-slate-700 leading-tight">
                  <span className="font-bold text-slate-800 block mb-1">I accept and confirm</span>
                  that all Receive & Delivery quantities are complete and verified for this ERP file.
                </span>
              </label>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1" title="বন্ধের তারিখ">Close Date *</label>
                  <input 
                    type="date" 
                    value={closeDate} 
                    onChange={e => setCloseDate(e.target.value)} 
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1" title="চূড়ান্ত ডেলিভারি পরিমাণ">Final Delivered Qty *</label>
                  <input 
                    type="number" 
                    value={finalDelivered} 
                    onChange={e => setFinalDelivered(e.target.value)} 
                    className={`w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 ${!isFinalDeliveredMatch ? 'border-red-400 focus:ring-red-500' : 'border-slate-300'}`}
                    required
                  />
                  {!isFinalDeliveredMatch && (
                     <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-mono">
                       <AlertCircle className="w-3 h-3" />
                       Must exactly equal Total Received: {formatNumber(totalRcv)}
                     </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button 
                type="submit" 
                disabled={!confirmed || !closeDate || !isFinalDeliveredMatch || closeMutation.isPending || totalDel < selectedOrder.order_qty}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {closeMutation.isPending ? 'Locking...' : <><Lock className="w-4 h-4" /> Lock Archive</>}
              </button>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded font-medium transition-colors text-sm"
                disabled={closeMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
