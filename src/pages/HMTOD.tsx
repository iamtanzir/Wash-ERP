import React, { useState, useMemo } from 'react';
import { Ship, AlertTriangle, CheckCircle2, Search, Filter, Download, ArrowRight, Activity } from 'lucide-react';
import { cn, formatNumber } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import Papa from 'papaparse';
import { toast } from 'sonner';

// Default / fallback data structure
const mockDataGroups = [
  {
    name: "1st.Floor ERP Plan",
    totals: { target1: 8090, target2: 6985, target3: 6176, target4: 72186, totalShip: 118496, erpQty: 190029, wRecv: 50728, wDeli: 37636, wBln: 13092, needRfd: 67998, needWash: 81090, sewPlans: [6300, 5350, 9600, 16000, 19800, 18863], sewPlanTarget: 75913, sewPlanMiss: 6139 },
    items: [
      { erpId: "111-7881", washType: "GarmentDye EnzmWash", shipTargets: { target1: 0, target2: 399, target3: 1322, target4: 130 }, totalShipQty: 7474, erpQty: 7474, wRecv: 6600, wDeli: 6400, wBln: 200, needRfdFromSew: 874, needWashClose: 1074, sewPlans: [500, 0, 0, 0, 0, 0], sewPlanTarget: 500, sewPlanMiss: 374 },
      { erpId: "111-7977", washType: "GarmentDyeSnowWash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 0 }, totalShipQty: 1157, erpQty: 1462, wRecv: 1387, wDeli: 1387, wBln: 0, needRfdFromSew: 0, needWashClose: 0, sewPlans: [0, 150, 0, 0, 0, 0], sewPlanTarget: 150, sewPlanMiss: 0 },
      { erpId: "111-7992", washType: "Garment Dye Snow Wash", shipTargets: { target1: 1754, target2: 334, target3: 1502, target4: 6948 }, totalShipQty: 16369, erpQty: 21754, wRecv: 9484, wDeli: 7846, wBln: 1638, needRfdFromSew: 6885, needWashClose: 8523, sewPlans: [1300, 1300, 1600, 0, 0, 0], sewPlanTarget: 4200, sewPlanMiss: 2685 },
      { erpId: "111-8013", washType: "GarmentDyesnowWash", shipTargets: { target1: 3030, target2: 0, target3: 0, target4: 6950 }, totalShipQty: 19989, erpQty: 28451, wRecv: 16500, wDeli: 11346, wBln: 5154, needRfdFromSew: 3489, needWashClose: 8643, sewPlans: [1000, 1000, 0, 0, 0, 0], sewPlanTarget: 2000, sewPlanMiss: 1489 },
      { erpId: "111-8020", washType: "Pig Dy Enzm Wash", shipTargets: { target1: 1266, target2: 877, target3: 0, target4: 0 }, totalShipQty: 3634, erpQty: 6129, wRecv: 3362, wDeli: 3362, wBln: 0, needRfdFromSew: 272, needWashClose: 272, sewPlans: [1200, 0, 0, 0, 0, 0], sewPlanTarget: 1200, sewPlanMiss: 0 },
      { erpId: "111-8043", washType: "Enzyme Wash", shipTargets: { target1: 1821, target2: 3461, target3: 0, target4: 2893 }, totalShipQty: 9123, erpQty: 10549, wRecv: 8695, wDeli: 7295, wBln: 1400, needRfdFromSew: 428, needWashClose: 1828, sewPlans: [1800, 0, 0, 0, 0, 0], sewPlanTarget: 1800, sewPlanMiss: 0 },
      { erpId: "111-8049-Garment Dye Snow Wash (us)", washType: "", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 5063 }, totalShipQty: 5063, erpQty: 5063, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 5063, needWashClose: 5063, sewPlans: [0, 0, 0, 1500, 1700, 1863], sewPlanTarget: 5063, sewPlanMiss: 0, bgClass: "bg-yellow-200" },
      { erpId: "111-8050", washType: "Garment Dye Snow Wash", shipTargets: { target1: 219, target2: 0, target3: 0, target4: 0 }, totalShipQty: 219, erpQty: 219, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 219, needWashClose: 219, sewPlans: [0, 0, 0, 0, 0, 0], sewPlanTarget: 0, sewPlanMiss: 219 },
      { erpId: "111-8071", washType: "GarmentDyeEnzmWash", shipTargets: { target1: 0, target2: 200, target3: 0, target4: 0 }, totalShipQty: 200, erpQty: 371, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 200, needWashClose: 200, sewPlans: [0, 400, 0, 0, 0, 0], sewPlanTarget: 400, sewPlanMiss: 0 },
      { erpId: "111-8072", washType: "GarmentDyeEnzmWash", shipTargets: { target1: 0, target2: 0, target3: 450, target4: 250 }, totalShipQty: 700, erpQty: 700, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 700, needWashClose: 700, sewPlans: [0, 0, 700, 0, 0, 0], sewPlanTarget: 700, sewPlanMiss: 0 },
      { erpId: "111-8085", washType: "-Enzyme Wash", shipTargets: { target1: 0, target2: 209, target3: 79, target4: 316 }, totalShipQty: 604, erpQty: 1450, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 604, needWashClose: 604, sewPlans: [0, 1000, 600, 0, 0, 0], sewPlanTarget: 1600, sewPlanMiss: 0 },
      { erpId: "111-8094", washType: "Pig Dye Enzm Wash", shipTargets: { target1: 0, target2: 1304, target3: 2747, target4: 7232 }, totalShipQty: 11283, erpQty: 19576, wRecv: 4700, wDeli: 0, wBln: 4700, needRfdFromSew: 6583, needWashClose: 11283, sewPlans: [500, 1500, 1500, 1800, 0, 0], sewPlanTarget: 5300, sewPlanMiss: 1283, bgClass: "bg-green-200" },
      { erpId: "111-8095", washType: "-Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 3365 }, totalShipQty: 3365, erpQty: 4383, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 3365, needWashClose: 3365, sewPlans: [0, 0, 500, 1500, 1500, 900], sewPlanTarget: 4400, sewPlanMiss: 0 },
      { erpId: "111-8096", washType: "Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 10758 }, totalShipQty: 10758, erpQty: 14480, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 10758, needWashClose: 10758, sewPlans: [0, 0, 500, 2200, 4000, 4000], sewPlanTarget: 10700, sewPlanMiss: 58 },
      { erpId: "111-8097", washType: "Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 9161 }, totalShipQty: 9161, erpQty: 12325, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 9161, needWashClose: 9161, sewPlans: [0, 0, 1000, 1800, 4000, 3000], sewPlanTarget: 9800, sewPlanMiss: 0 },
      { erpId: "111-8098", washType: "-Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 5602 }, totalShipQty: 5602, erpQty: 7731, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 5602, needWashClose: 5602, sewPlans: [0, 0, 800, 1800, 1800, 1800], sewPlanTarget: 6200, sewPlanMiss: 0 },
      { erpId: "111-8100", washType: "Enzyme wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 1598 }, totalShipQty: 1598, erpQty: 4599, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 1598, needWashClose: 1598, sewPlans: [0, 0, 800, 1500, 1800, 500], sewPlanTarget: 4600, sewPlanMiss: 0 },
      { erpId: "111-8101", washType: "Enzyme wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 7231 }, totalShipQty: 7231, erpQty: 13908, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 7231, needWashClose: 7231, sewPlans: [0, 0, 800, 1800, 1800, 2800], sewPlanTarget: 7200, sewPlanMiss: 31 },
      { erpId: "111-8131", washType: "Enzyme Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 4170 }, totalShipQty: 4170, erpQty: 26042, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 4170, needWashClose: 4170, sewPlans: [0, 0, 800, 1800, 1800, 1800], sewPlanTarget: 6200, sewPlanMiss: 0 },
      { erpId: "111-8133", washType: "-Enzyme wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 226 }, totalShipQty: 226, erpQty: 1997, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 226, needWashClose: 226, sewPlans: [0, 0, 0, 300, 700, 1000], sewPlanTarget: 2000, sewPlanMiss: 0 },
      { erpId: "111-8160", washType: "-Enzyme Wash", shipTargets: { target1: 0, target2: 201, target3: 76, target4: 293 }, totalShipQty: 570, erpQty: 1366, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 570, needWashClose: 570, sewPlans: [0, 0, 0, 0, 700, 1200], sewPlanTarget: 1900, sewPlanMiss: 0 }
    ]
  },
  {
    name: "2nd.Floor ERP Plan",
    totals: { target1: 0, target2: 2294, target3: 4029, target4: 5805, totalShip: 12128, erpQty: 24730, wRecv: 5246, wDeli: 2360, wBln: 2886, needRfd: 7703, needWash: 9768, sewPlans: [1400, 1755, 800, 1900, 2800, 4700], sewPlanTarget: 13355, sewPlanMiss: 1533 },
    items: [
      { erpId: "111-8007", washType: "Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 724, target4: 0 }, totalShipQty: 724, erpQty: 1464, wRecv: 1545, wDeli: 591, wBln: 954, needRfdFromSew: 0, needWashClose: 133, sewPlans: [0, 0, 0, 0, 0, 0], sewPlanTarget: 0, sewPlanMiss: 0 },
      { erpId: "111-8009", washType: "WashGarmentSpray Wash", shipTargets: { target1: 0, target2: 638, target3: 2634, target4: 150 }, totalShipQty: 3422, erpQty: 3781, wRecv: 3225, wDeli: 1293, wBln: 1932, needRfdFromSew: 197, needWashClose: 2129, sewPlans: [500, 0, 0, 0, 0, 0], sewPlanTarget: 500, sewPlanMiss: 0, bgClass: "bg-green-200" },
      { erpId: "111-8011", washType: "WashGarmentSpray Wash", shipTargets: { target1: 0, target2: 0, target3: 596, target4: 183 }, totalShipQty: 779, erpQty: 990, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 779, needWashClose: 779, sewPlans: [400, 700, 0, 0, 0, 0], sewPlanTarget: 1100, sewPlanMiss: 0 },
      { erpId: "111-8049", washType: "- Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 773 }, totalShipQty: 773, erpQty: 6173, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 773, needWashClose: 773, sewPlans: [0, 300, 800, 1600, 1600, 0], sewPlanTarget: 5900, sewPlanMiss: 0, bgClass: "bg-yellow-200" },
      { erpId: "111-8058", washType: "GarmentDye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 154 }, totalShipQty: 154, erpQty: 1125, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 154, needWashClose: 154, sewPlans: [0, 0, 0, 0, 300, 0], sewPlanTarget: 300, sewPlanMiss: 0 },
      { erpId: "111-8065", washType: "-Enzyme Wash (07-196 us)", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 3633 }, totalShipQty: 3633, erpQty: 3633, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 3633, needWashClose: 3633, sewPlans: [0, 0, 0, 300, 800, 1000], sewPlanTarget: 2100, sewPlanMiss: 1533, bgClass: "bg-yellow-200" },
      { erpId: "111-8073", washType: "Garment Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 292 }, totalShipQty: 292, erpQty: 3189, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 292, needWashClose: 292, sewPlans: [0, 0, 0, 0, 0, 300], sewPlanTarget: 300, sewPlanMiss: 0 },
      { erpId: "111-8087", washType: "Dis Dye Snow Wash", shipTargets: { target1: 0, target2: 1656, target3: 75, target4: 0 }, totalShipQty: 1731, erpQty: 1731, wRecv: 476, wDeli: 476, wBln: 0, needRfdFromSew: 1255, needWashClose: 1255, sewPlans: [500, 755, 0, 0, 0, 0], sewPlanTarget: 1255, sewPlanMiss: 0, bgClass: "bg-green-200" },
      { erpId: "111-8146", washType: "-ReactiveDyeEnzm Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 620 }, totalShipQty: 620, erpQty: 2644, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 620, needWashClose: 620, sewPlans: [0, 0, 0, 0, 400, 1500], sewPlanTarget: 1900, sewPlanMiss: 0 }
    ]
  },
  {
    name: "Gnd.Floor ERP Plan",
    totals: { target1: 27616, target2: 20628, target3: 3218, target4: 34561, totalShip: 129878, erpQty: 171346, wRecv: 89860, wDeli: 68454, wBln: 21406, needRfd: 44560, needWash: 61424, sewPlans: [7300, 8800, 7600, 9400, 9620, 6700], sewPlanTarget: 49420, sewPlanMiss: 4281 },
    items: [
      { erpId: "111-7991", washType: "ReactiveDyeEnzmWash", shipTargets: { target1: 1764, target2: 307, target3: 1544, target4: 11569 }, totalShipQty: 21164, erpQty: 29111, wRecv: 11419, wDeli: 11419, wBln: 0, needRfdFromSew: 9745, needWashClose: 9745, sewPlans: [500, 1500, 1600, 2000, 2200, 2200], sewPlanTarget: 10000, sewPlanMiss: 0, bgClass: "bg-green-200" },
      { erpId: "111-7995", washType: "Direct Dye Snow Wash", shipTargets: { target1: 0, target2: 0, target3: 7302, target4: 0 }, totalShipQty: 7302, erpQty: 12759, wRecv: 3050, wDeli: 0, wBln: 3050, needRfdFromSew: 4252, needWashClose: 7302, sewPlans: [2000, 2000, 1500, 2000, 220, 0], sewPlanTarget: 7720, sewPlanMiss: 0 },
      { erpId: "111-8035", washType: "GarmentDyeSnowWash", shipTargets: { target1: 12566, target2: 0, target3: 1237, target4: 0 }, totalShipQty: 43829, erpQty: 46305, wRecv: 48371, wDeli: 42174, wBln: 6197, needRfdFromSew: 0, needWashClose: 1655, sewPlans: [0, 0, 0, 0, 0, 0], sewPlanTarget: 0, sewPlanMiss: 0, bgClass: "bg-green-200" },
      { erpId: "111-8036", washType: "GarmentDyeSnow Wash", shipTargets: { target1: 4481, target2: 94, target3: 0, target4: 281 }, totalShipQty: 9618, erpQty: 9683, wRecv: 7792, wDeli: 6499, wBln: 1293, needRfdFromSew: 1826, needWashClose: 3119, sewPlans: [1000, 1500, 0, 0, 0, 0], sewPlanTarget: 2500, sewPlanMiss: 0, bgClass: "bg-green-200" },
      { erpId: "111-8042", washType: "-Garment Dye Snow Wash", shipTargets: { target1: 219, target2: 0, target3: 0, target4: 0 }, totalShipQty: 219, erpQty: 219, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 219, needWashClose: 219, sewPlans: [0, 0, 0, 0, 0, 0], sewPlanTarget: 0, sewPlanMiss: 219 },
      { erpId: "111-8064", washType: "Enzyme Wash", shipTargets: { target1: 4900, target2: 9240, target3: 0, target4: 4520 }, totalShipQty: 21747, erpQty: 30426, wRecv: 14975, wDeli: 8362, wBln: 6613, needRfdFromSew: 6772, needWashClose: 13385, sewPlans: [1800, 1800, 1500, 1800, 1800, 0], sewPlanTarget: 8700, sewPlanMiss: 0, bgClass: "bg-green-200" },
      { erpId: "111-8065", washType: "-Enzyme Wash", shipTargets: { target1: 3686, target2: 10453, target3: 0, target4: 1898 }, totalShipQty: 16037, erpQty: 23172, wRecv: 4253, wDeli: 0, wBln: 4253, needRfdFromSew: 11784, needWashClose: 16037, sewPlans: [2000, 2000, 2000, 2600, 2600, 3000], sewPlanTarget: 14200, sewPlanMiss: 0 },
      { erpId: "111-8074", washType: "Garment Dye Enzm Wash", shipTargets: { target1: 0, target2: 0, target3: 0, target4: 8162 }, totalShipQty: 8162, erpQty: 14258, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 8162, needWashClose: 8162, sewPlans: [0, 0, 0, 1000, 1600, 1500], sewPlanTarget: 4100, sewPlanMiss: 4062 },
      { erpId: "111-8081", washType: "Enzyme Wash", shipTargets: { target1: 0, target2: 269, target3: 183, target4: 301 }, totalShipQty: 753, erpQty: 2045, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 753, needWashClose: 753, sewPlans: [0, 0, 1000, 0, 0, 0], sewPlanTarget: 1000, sewPlanMiss: 0 },
      { erpId: "111-8082", washType: "Enzyme Wash", shipTargets: { target1: 0, target2: 265, target3: 254, target4: 528 }, totalShipQty: 1047, erpQty: 3368, wRecv: 0, wDeli: 0, wBln: 0, needRfdFromSew: 1047, needWashClose: 1047, sewPlans: [0, 0, 0, 0, 1200, 0], sewPlanTarget: 1200, sewPlanMiss: 0 }
    ]
  }
];

export default function HMTOD() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroupedData = useMemo(() => {
    return mockDataGroups.map(group => ({
      ...group,
      items: group.items.filter(d => 
        d.erpId.toLowerCase().includes(searchTerm.toLowerCase()) || 
        d.washType.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(group => group.items.length > 0 || searchTerm === '');
  }, [searchTerm]);

  const summaryStats = useMemo(() => {
    let totalShip = 0;
    let totalDeli = 0;
    let totalWip = 0;
    let totalMiss = 0;

    filteredGroupedData.forEach(group => {
      group.items.forEach(item => {
        totalShip += item.totalShipQty || 0;
        totalDeli += item.wDeli || 0;
        totalWip += item.wBln || 0;
        totalMiss += item.sewPlanMiss || 0;
      });
    });

    return { totalShip, totalDeli, totalWip, totalMiss };
  }, [filteredGroupedData]);

  const handleExport = () => {
    const flatRows: any[] = [];
    filteredGroupedData.forEach(group => {
      group.items.forEach(item => {
        flatRows.push({
          'Floor Plan': group.name,
          'ERP ID': item.erpId,
          'Wash Type': item.washType,
          'Ship Target 20-May': item.shipTargets.target1,
          'Ship Target 30-May': item.shipTargets.target2,
          'Ship Target 3-Jun': item.shipTargets.target3,
          'Ship Target 6-Jun': item.shipTargets.target4,
          'Total Ship Qty (EID)': item.totalShipQty,
          'ERP Qty': item.erpQty,
          'Wash Recv': item.wRecv,
          'Wash Deli': item.wDeli,
          'Wash WIP': item.wBln,
          'Need RFD from Sew': item.needRfdFromSew,
          'Need Wash Close': item.needWashClose,
          'Sew Plan Target': item.sewPlanTarget,
          'Sew Plan Miss Qty': item.sewPlanMiss
        });
      });
    });

    if (flatRows.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const csv = Papa.unparse(flatRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `hm_ship_risk_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">H&M SHIP RISK ANALYSIS</h1>
          <p className="text-slate-500 text-sm mt-1">Target Order Delivery Tracking & Capacity Feasibility</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search ERP or Wash..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
            />
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold transition-colors"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border text-center p-4 rounded-2xl shadow-sm border-slate-200">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Ship Target</div>
          <div className="text-2xl font-black text-slate-800">{formatNumber(summaryStats.totalShip)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 text-center p-4 rounded-2xl shadow-sm">
          <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Wash Delivery (Actual)</div>
          <div className="text-2xl font-black text-blue-800">{formatNumber(summaryStats.totalDeli)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 text-center p-4 rounded-2xl shadow-sm">
          <div className="text-amber-600 text-xs font-bold uppercase tracking-wider mb-1">Total WIP</div>
          <div className="text-2xl font-black text-amber-800">{formatNumber(summaryStats.totalWip)}</div>
        </div>
        <div className="bg-red-50 border border-red-100 text-center p-4 rounded-2xl shadow-sm">
          <div className="text-red-600 text-xs font-bold uppercase tracking-wider mb-1">Sew Plan Miss Qty</div>
          <div className="text-2xl font-black text-red-800">{formatNumber(summaryStats.totalMiss)}</div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left border-collapse min-w-max">
              <thead className="bg-[#f8fafc] text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-1.5 py-1.5 border-r bg-white sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[140px] min-w-[140px] max-w-[140px]" rowSpan={2}>ERP Plan</th>
                  <th className="px-1.5 py-1 border-r bg-indigo-50 text-indigo-800 text-center" colSpan={4}>Ship TOD</th>
                  <th className="px-1.5 py-1 border-r bg-pink-50 text-pink-800 text-center" rowSpan={2}>Total Ship Qty<br/>(EID)</th>
                  <th className="px-1.5 py-1 border-r bg-purple-50 text-purple-800 text-center" rowSpan={2}>ERP Qty</th>
                  <th className="px-1.5 py-1 border-r bg-emerald-50 text-emerald-800 text-center" colSpan={3}>Wash Progress</th>
                  <th className="px-1.5 py-1 border-r bg-yellow-50 text-yellow-800 text-center" colSpan={2}>Shortage / Needs</th>
                  <th className="px-1.5 py-1 bg-blue-50 text-blue-800 text-center" colSpan={8}>Sew Plan vs Target</th>
                </tr>
                <tr>
                  <th className="px-1 py-1 border-r border-t bg-indigo-50 text-indigo-700 text-center">20-May</th>
                  <th className="px-1 py-1 border-r border-t bg-indigo-50 text-indigo-700 text-center">30-May</th>
                  <th className="px-1 py-1 border-r border-t bg-indigo-50 text-indigo-700 text-center">3-Jun</th>
                  <th className="px-1 py-1 border-r border-t bg-indigo-50 text-indigo-700 text-center">6-Jun</th>

                  <th className="px-1 py-1 border-r border-t bg-emerald-50 text-emerald-700 text-center">W.Recv</th>
                  <th className="px-1 py-1 border-r border-t bg-emerald-50 text-emerald-700 text-center">W.Deli</th>
                  <th className="px-1 py-1 border-r border-t bg-emerald-50 text-emerald-700 text-center">WIP</th>

                  <th className="px-1 py-1 border-r border-t bg-yellow-50 text-yellow-700 text-center leading-tight">Need RFD<br />from Sew</th>
                  <th className="px-1 py-1 border-r border-t bg-yellow-50 text-yellow-700 text-center leading-tight">Need Wash<br />Close</th>

                  <th className="px-0.5 py-1 border-r border-t bg-blue-50 text-blue-700 text-center text-[10px]">20-May</th>
                  <th className="px-0.5 py-1 border-r border-t bg-blue-50 text-blue-700 text-center text-[10px]">21-May</th>
                  <th className="px-0.5 py-1 border-r border-t bg-blue-50 text-blue-700 text-center text-[10px]">22-May</th>
                  <th className="px-0.5 py-1 border-r border-t bg-blue-50 text-blue-700 text-center text-[10px]">23-May</th>
                  <th className="px-0.5 py-1 border-r border-t bg-blue-50 text-blue-700 text-center text-[10px]">24-May</th>
                  <th className="px-0.5 py-1 border-r border-t bg-blue-50 text-blue-700 text-center text-[10px]">25-May</th>
                  <th className="px-1 py-1 border-r border-t bg-blue-100 text-blue-800 text-center leading-tight">For<br/>6-Jun</th>
                  <th className="px-1 py-1 border-t bg-red-50 text-red-700 text-center leading-tight">Miss<br/>Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredGroupedData.map((group, groupIdx) => (
                  <React.Fragment key={groupIdx}>
                    <tr className="bg-slate-100 font-bold border-y-2 border-slate-200">
                      <td className="px-1.5 py-1 border-r text-rose-600 bg-slate-100 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[140px] min-w-[140px] max-w-[140px] break-words whitespace-normal" colSpan={1}>{group.name}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.target1 ? group.totals.target1.toLocaleString() : '0'}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.target2 ? group.totals.target2.toLocaleString() : '0'}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.target3 ? group.totals.target3.toLocaleString() : '0'}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.target4 ? group.totals.target4.toLocaleString() : '0'}</td>
                      <td className="px-1 py-1 border-r text-center text-pink-600 bg-pink-50/50">{group.totals.totalShip.toLocaleString()}</td>
                      <td className="px-1 py-1 border-r text-center text-green-600 bg-green-50/30">{group.totals.erpQty.toLocaleString()}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.wRecv.toLocaleString()}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.wDeli.toLocaleString()}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.wBln.toLocaleString()}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.needRfd.toLocaleString()}</td>
                      <td className="px-1 py-1 border-r text-center text-rose-600">{group.totals.needWash.toLocaleString()}</td>
                      
                      {group.totals.sewPlans.map((val, i) => (
                        <td key={i} className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">{val ? val.toLocaleString() : ''}</td>
                      ))}
                      <td className="px-1 py-1 border-r text-center text-blue-700 bg-yellow-200">{group.totals.sewPlanTarget.toLocaleString()}</td>
                      <td className="px-1 py-1 text-center text-red-600 bg-red-100">{group.totals.sewPlanMiss > 0 ? group.totals.sewPlanMiss.toLocaleString() : '0'}</td>
                    </tr>

                    {group.items.map((row, idx) => (
                      <tr key={`${groupIdx}-${idx}`} className={cn("hover:bg-blue-50 transition-colors group", (row as any).bgClass)}>
                        <td className={cn("px-1.5 py-1 border-r group-hover:bg-blue-50 sticky left-0 z-10 w-[140px] min-w-[140px] max-w-[140px]", (row as any).bgClass || "bg-white", "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]")}>
                          <div className="font-semibold text-slate-800 break-words whitespace-normal">{row.erpId}</div>
                          <div className="text-[9px] text-slate-500 break-words whitespace-normal leading-tight mt-0.5">{row.washType}</div>
                        </td>
                        <td className="px-1 py-1 border-r text-center">{row.shipTargets.target1 ? row.shipTargets.target1.toLocaleString() : ''}</td>
                        <td className="px-1 py-1 border-r text-center">{row.shipTargets.target2 ? row.shipTargets.target2.toLocaleString() : ''}</td>
                        <td className="px-1 py-1 border-r text-center">{row.shipTargets.target3 ? row.shipTargets.target3.toLocaleString() : ''}</td>
                        <td className="px-1 py-1 border-r text-center">{row.shipTargets.target4 ? row.shipTargets.target4.toLocaleString() : ''}</td>
                        
                        <td className="px-1 py-1 border-r text-center font-bold text-slate-700 bg-slate-50/50">{row.totalShipQty.toLocaleString()}</td>
                        <td className="px-1 py-1 border-r text-center font-bold text-slate-700">{row.erpQty.toLocaleString()}</td>
                        
                        <td className="px-1 py-1 border-r text-center">{row.wRecv.toLocaleString()}</td>
                        <td className="px-1 py-1 border-r text-center text-green-700">{row.wDeli.toLocaleString()}</td>
                        <td className="px-1 py-1 border-r text-center bg-emerald-50/30">{row.wBln.toLocaleString()}</td>
                        
                        <td className="px-1 py-1 border-r text-center font-bold text-amber-700 bg-yellow-50">{row.needRfdFromSew.toLocaleString()}</td>
                        <td className="px-1 py-1 border-r text-center font-bold text-amber-700 bg-yellow-50">{row.needWashClose.toLocaleString()}</td>
                        
                        {row.sewPlans.map((val, i) => (
                          <td key={i} className="px-0.5 py-1 border-r text-center text-[10px] text-slate-600">{val ? val.toLocaleString() : ''}</td>
                        ))}
                        <td className="px-1 py-1 border-r text-center font-bold text-blue-700 bg-blue-50">{row.sewPlanTarget.toLocaleString()}</td>
                        <td className="px-1 py-1 text-center font-bold text-red-600 bg-red-50/50">{row.sewPlanMiss > 0 ? row.sewPlanMiss.toLocaleString() : '0'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <tr>
                  <td className="px-1.5 py-1 border-r text-slate-800 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-slate-100 text-rose-600 w-[140px] min-w-[140px] max-w-[140px]">Grand Total</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">35,706</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">29,907</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">13,423</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">112,552</td>
                  <td className="px-1 py-1 border-r text-center text-pink-600 bg-pink-50/50">260,502</td>
                  <td className="px-1 py-1 border-r text-center text-purple-600">386,105</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">145,834</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">108,450</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">37,384</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">120,261</td>
                  <td className="px-1 py-1 border-r text-center text-rose-600">152,282</td>
                  <td className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">15,000</td>
                  <td className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">15,905</td>
                  <td className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">18,000</td>
                  <td className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">27,300</td>
                  <td className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">32,220</td>
                  <td className="px-0.5 py-1 border-r text-center text-rose-600 text-[10px]">30,263</td>
                  <td className="px-1 py-1 border-r text-center text-blue-700 bg-yellow-200">138,688</td>
                  <td className="px-1 py-1 text-center text-red-600 bg-red-100">11,953</td>
                </tr>
              </tfoot>
            </table>
          </div>
      </div>
    </div>
  );
}
