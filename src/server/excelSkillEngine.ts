/**
 * Inbuilt Excel Calculation Engine & Self-Improving Support Knowledge Store
 * Deterministic Excel formula evaluator (=SUM, =AVERAGE, =MIN, =MAX, =COUNT, =ROUND, =PCT, math)
 * + Live ERP Spreadsheet Rollups (Orders, Daily Logs, Buyers, 3-Shift Washing Reports)
 */

import {
  type SupportKnowledgeRule,
  type GeneratedExcelSheet,
  type CapturedIntent,
  INDUSTRIAL_SUPPORT_KNOWLEDGE,
  captureUserIntentAndEntities,
  calculateIndustrialWashChemical,
  calculateGarmentConsumptionAndCosting,
  calculateBdLaborAndHr
} from './industrialWashKnowledge.js';

export type { SupportKnowledgeRule, GeneratedExcelSheet, CapturedIntent };

export interface ExcelCalculationOutput {
  hasCalculation: boolean;
  intent?: CapturedIntent;
  formulaResult?: {
    expression: string;
    value: number | string;
    steps: string;
  };
  sheet?: GeneratedExcelSheet;
  summaryMarkdown: string;
}

function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      if (current.trim()) args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

// Safe recursive-descent arithmetic parser (no eval)
function evaluateMathExpression(expr: string): number {
  const cleaned = expr.replace(/\s+/g, '').replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!cleaned) throw new Error('Empty expression');
  let pos = 0;

  function peek(): string {
    return cleaned[pos] || '';
  }

  function parseExpression(): number {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = cleaned[pos++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = cleaned[pos++];
      const rhs = parseFactor();
      if (op === '/') {
        if (rhs === 0) throw new Error('Division by zero (#DIV/0!)');
        val /= rhs;
      } else {
        val *= rhs;
      }
    }
    return val;
  }

  function parseFactor(): number {
    if (peek() === '+') {
      pos++;
      return parseFactor();
    }
    if (peek() === '-') {
      pos++;
      return -parseFactor();
    }
    if (peek() === '(') {
      pos++;
      const inner = parseExpression();
      if (peek() !== ')') throw new Error('Mismatched parenthesis');
      pos++;
      return inner;
    }
    const start = pos;
    while ((cleaned[pos] >= '0' && cleaned[pos] <= '9') || cleaned[pos] === '.') {
      pos++;
    }
    if (start === pos) throw new Error(`Unexpected token near "${cleaned.slice(pos, pos + 8)}"`);
    const num = Number(cleaned.slice(start, pos));
    if (!Number.isFinite(num)) throw new Error('Invalid number');
    return num;
  }

  const res = parseExpression();
  if (pos < cleaned.length) {
    throw new Error(`Unexpected trailing character "${cleaned.slice(pos)}"`);
  }
  return res;
}

/**
 * Evaluates Excel-compatible formulas such as:
 * =SUM(102, 85, 35, 1335)
 * =AVERAGE(67, 85, 35)
 * =PCT(1207, 2500)
 * =ROUND(1207/2500*100, 2)
 */
export function evaluateExcelFormula(rawInput: string): {
  expression: string;
  value: number | string;
  steps: string;
} | null {
  const trimmed = String(rawInput || '').trim();
  const fnPattern = /^=?\s*(SUM|AVERAGE|AVG|MIN|MAX|COUNT|ROUND|PCT|PERCENT|VAR|VARIANCE|DIFF|CHEM|OWG|BDOT|BDWAGE|EFF|KNITCONS)\s*\((.*)\)\s*$/i;
  const fnMatch = trimmed.match(fnPattern);

  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const rawArgs = splitTopLevelArgs(fnMatch[2]);
    const nums = rawArgs.map(arg => {
      const nested = evaluateExcelFormula(arg);
      if (nested && typeof nested.value === 'number') return nested.value;
      return evaluateMathExpression(arg);
    });

    if (nums.length === 0) {
      return { expression: trimmed, value: '#VALUE!', steps: 'No numeric arguments supplied' };
    }

    let value = 0;
    let steps = '';
    switch (fnName) {
      case 'SUM':
        value = nums.reduce((a, b) => a + b, 0);
        steps = `=${fnName}(${nums.join(', ')}) = ${Number(value.toFixed(4))}`;
        break;
      case 'AVERAGE':
      case 'AVG':
        value = nums.reduce((a, b) => a + b, 0) / nums.length;
        steps = `=${fnName}(${nums.join(', ')}) = ${nums.reduce((a, b) => a + b, 0)} / ${nums.length} = ${Number(value.toFixed(2))}`;
        break;
      case 'MIN':
        value = Math.min(...nums);
        steps = `=MIN(${nums.join(', ')}) = ${value}`;
        break;
      case 'MAX':
        value = Math.max(...nums);
        steps = `=MAX(${nums.join(', ')}) = ${value}`;
        break;
      case 'COUNT':
        value = nums.length;
        steps = `=COUNT(${nums.join(', ')}) = ${value}`;
        break;
      case 'ROUND': {
        const dec = nums[1] ?? 2;
        const factor = Math.pow(10, dec);
        value = Math.round(nums[0] * factor) / factor;
        steps = `=ROUND(${nums[0]}, ${dec}) = ${value}`;
        break;
      }
      case 'PCT':
      case 'PERCENT': {
        const part = nums[0];
        const total = nums[1] ?? 100;
        value = total === 0 ? 0 : Number(((part / total) * 100).toFixed(2));
        steps = `=(${part} / ${total}) * 100 = ${value}%`;
        break;
      }
      case 'VAR':
      case 'VARIANCE':
      case 'DIFF': {
        const a = nums[0];
        const b = nums[1] ?? 0;
        value = Number((a - b).toFixed(2));
        steps = `=${a} - ${b} = ${value}`;
        break;
      }
      case 'CHEM': {
        const dryKg = nums[0];
        const lr = nums[1] ?? 8;
        const gl = nums[2] ?? 1;
        value = Number(((dryKg * lr * gl) / 1000).toFixed(3));
        steps = `=(${dryKg} Kg × ${lr} L:R × ${gl} g/L) / 1000 = ${value} Kg chemical`;
        break;
      }
      case 'OWG': {
        const dryKg = nums[0];
        const pct = nums[1] ?? 1;
        value = Number((dryKg * (pct / 100)).toFixed(3));
        steps = `=${dryKg} Kg × (${pct}% / 100) = ${value} Kg chemical`;
        break;
      }
      case 'BDOT': {
        const basic = nums[0];
        const hrs = nums[1] ?? 1;
        value = Number((((basic / 208) * 2) * hrs).toFixed(2));
        steps = `=Sec 108 BD OT: ((${basic} / 208) × 2) × ${hrs} hrs = ${value} BDT`;
        break;
      }
      case 'BDWAGE': {
        const basic = nums[0];
        const house = basic * 0.5;
        value = Number((basic + house + 750 + 450 + 1250).toFixed(2));
        steps = `=${basic} Basic + ${house} House(50%) + 750 Med + 450 Conv + 1250 Food = ${value} BDT Gross`;
        break;
      }
      case 'EFF': {
        const pcs = nums[0];
        const sam = nums[1] ?? 14;
        const workers = nums[2] ?? 30;
        const mins = nums[3] ?? 480;
        value = workers * mins === 0 ? 0 : Number((((pcs * sam) / (workers * mins)) * 100).toFixed(2));
        steps = `=((${pcs} × ${sam}) / (${workers} × ${mins})) × 100 = ${value}% Efficiency`;
        break;
      }
      case 'KNITCONS': {
        const len = nums[0] ?? 74;
        const chest = nums[1] ?? 56;
        const gsm = nums[2] ?? 180;
        const wast = nums[3] ?? 8;
        value = Number(((((len * chest * 2 * gsm) / 10_000_000) * 12) * 1.32 * (1 + wast / 100)).toFixed(3));
        steps = `=Knit Fabric Consumption (${len}×${chest}cm, ${gsm} GSM, +${wast}% wast.) = ${value} Kg/Dz`;
        break;
      }
    }

    return {
      expression: trimmed.startsWith('=') ? trimmed : `=${trimmed}`,
      value: Number.isInteger(value) ? value : Number(value.toFixed(4)),
      steps
    };
  }

  // Handle plain `=...` arithmetic formulas or standalone math like `(150 + 200) * 1.05`
  const looksLikeEquation =
    trimmed.startsWith('=') ||
    (/^[\d\s.+\-*/()%]+$/.test(trimmed) && /[+\-*/%]/.test(trimmed));

  if (looksLikeEquation) {
    try {
      const exprBody = trimmed.startsWith('=') ? trimmed.slice(1) : trimmed;
      const val = evaluateMathExpression(exprBody);
      const rounded = Number.isInteger(val) ? val : Number(val.toFixed(4));
      return {
        expression: trimmed.startsWith('=') ? trimmed : `=${trimmed}`,
        value: rounded,
        steps: `${exprBody.trim()} = ${rounded}`
      };
    } catch (err: any) {
      return {
        expression: trimmed,
        value: err?.message?.includes('#DIV/0!') ? '#DIV/0!' : '#VALUE!',
        steps: err?.message || 'Invalid formula syntax'
      };
    }
  }

  return null;
}

/**
 * Runs live ERP Excel-style spreadsheet aggregations & formula calculations
 * depending on user intent (Buyer summary sheet, Shift A/B/C calculation sheet, Order calculation, or direct formula).
 */
export function runErpExcelCalculationSkill(params: {
  query: string;
  ordersSummary: any[];
  buyerRollup: any[];
  shiftReports: any[];
  washRejections?: any[];
  fiveYearYearlyStats?: { year: string; ordersCount: number; receivedPcs: number; deliveredPcs: number; washKg: number; archivedCount: number }[];
  todayDate: string;
}): ExcelCalculationOutput {
  const q = String(params.query || '').trim();
  const intent = captureUserIntentAndEntities(q);
  const qLower = intent.normalizedQuery;

  // 1. Direct Excel formula / math check
  const formulaResult = evaluateExcelFormula(q);
  if (formulaResult) {
    return {
      hasCalculation: true,
      intent,
      formulaResult,
      summaryMarkdown: `📐 **Excel Formula Result**\n• Formula: \`${formulaResult.expression}\`\n• Value: **${formulaResult.value}**\n• Calculation: ${formulaResult.steps}`
    };
  }

  // 1b. Inbuilt Industrial Wash Chemical Formula Engine
  if (intent.domain === 'wash_chemical') {
    const chemCalc = calculateIndustrialWashChemical(q, intent, params.todayDate);
    return {
      hasCalculation: true,
      intent,
      sheet: chemCalc.sheet,
      summaryMarkdown: chemCalc.summaryMarkdown
    };
  }

  // 1c. Inbuilt BD Worker Labor Law, OT & HR Compliance Engine
  if (intent.domain === 'bd_labor_hr') {
    const hrCalc = calculateBdLaborAndHr(q, intent, params.todayDate);
    return {
      hasCalculation: true,
      intent,
      sheet: hrCalc.sheet,
      summaryMarkdown: hrCalc.summaryMarkdown
    };
  }

  // 1d. Inbuilt All-Over Garment Consumption, Efficiency & FOB Costing Engine
  if (intent.domain === 'garment_consumption') {
    const gmtCalc = calculateGarmentConsumptionAndCosting(q, intent, params.todayDate);
    return {
      hasCalculation: true,
      intent,
      sheet: gmtCalc.sheet,
      summaryMarkdown: gmtCalc.summaryMarkdown
    };
  }

  // 1d-2. Multi-Buyer Wash Rejection Summary & .xlsx Rollup
  if (intent.domain === 'wash_rejection') {
    const rejs = Array.isArray(params.washRejections) ? params.washRejections : [];
    const orderRecvByErp = new Map<string, number>();
    for (const o of params.ordersSummary || []) {
      const k = String(o.file_no || o.id || '').trim().toLowerCase();
      if (k) orderRecvByErp.set(k, (orderRecvByErp.get(k) || 0) + (Number(o.total_received_qty) || 0));
    }

    const byBuyerErpType = new Map<string, {
      buyer: string; erpNo: string; colour: string; rejectionType: string;
      xs: number; s: number; m: number; l: number; xl: number; xxl: number; noSize: number; ttl: number;
    }>();

    let totalBefore = 0;
    let totalAfter = 0;
    for (const r of rejs) {
      const ttl = Number(r.ttl) || (Number(r.xs || 0) + Number(r.s || 0) + Number(r.m || 0) + Number(r.l || 0) + Number(r.xl || 0) + Number(r.xxl || 0) + Number(r.noSize || 0));
      const rType = String(r.rejectionType || 'Before Wash Rejections');
      if (/after/i.test(rType)) totalAfter += ttl;
      else totalBefore += ttl;

      const gk = `${r.buyer || 'Unknown'}||${r.erpNo || ''}||${r.colour || ''}||${rType}`;
      if (!byBuyerErpType.has(gk)) {
        byBuyerErpType.set(gk, {
          buyer: String(r.buyer || 'Unknown'),
          erpNo: String(r.erpNo || ''),
          colour: String(r.colour || ''),
          rejectionType: rType,
          xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, noSize: 0, ttl: 0
        });
      }
      const g = byBuyerErpType.get(gk)!;
      g.xs += Number(r.xs) || 0;
      g.s += Number(r.s) || 0;
      g.m += Number(r.m) || 0;
      g.l += Number(r.l) || 0;
      g.xl += Number(r.xl) || 0;
      g.xxl += Number(r.xxl) || 0;
      g.noSize += Number(r.noSize) || 0;
      g.ttl += ttl;
    }

    const columns = ['Buyer', 'ERP', 'Colour', 'Rejection Type', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'No Size', 'TTL', 'Recv Qty', 'Percentage Upto'];
    const rows: (string | number)[][] = [];
    let grandTtl = 0;
    let grandRecv = 0;
    const seenErps = new Set<string>();

    for (const g of byBuyerErpType.values()) {
      const recv = orderRecvByErp.get(g.erpNo.trim().toLowerCase()) || 0;
      const pct = recv > 0 ? `${((g.ttl / recv) * 100).toFixed(2)}%` : 'N/A';
      grandTtl += g.ttl;
      if (g.erpNo && !seenErps.has(g.erpNo.toLowerCase())) {
        seenErps.add(g.erpNo.toLowerCase());
        grandRecv += recv;
      }
      rows.push([g.buyer, g.erpNo, g.colour, g.rejectionType, g.xs, g.s, g.m, g.l, g.xl, g.xxl, g.noSize, g.ttl, recv, pct]);
    }

    const overallPct = grandRecv > 0 ? `${((grandTtl / grandRecv) * 100).toFixed(2)}%` : '0.00%';
    const sheet: GeneratedExcelSheet = {
      sheetName: 'All_Buyers_Rejection_DB',
      fileName: `All_Buyers_Wash_Rejection_${params.todayDate}.xlsx`,
      columns,
      rows,
      summaryRow: ['TOTAL (=SUM)', `${seenErps.size} ERPs`, '', 'All Rejection Types', '', '', '', '', '', '', '', grandTtl, grandRecv, overallPct],
      formulaSummary: [
        `=SUM(Total Rejections) = ${grandTtl} pcs (Before Wash: ${totalBefore} pcs | After Wash: ${totalAfter} pcs)`,
        `=PCT(Rejection TTL, Recv Qty) = ${overallPct} across ${grandRecv.toLocaleString()} pcs received`
      ]
    };

    const previewLines = rows.slice(0, 8).map(r => `• **${r[0]}** (${r[1]} • ${r[2]}) — ${r[3]}: **${r[11]} pcs** (${r[13]} of ${Number(r[12]).toLocaleString()} recv)`).join('\n');
    return {
      hasCalculation: true,
      intent,
      sheet,
      summaryMarkdown: rows.length > 0
        ? `🔍 **Multi-Buyer Wash Rejection DB Summary (${rejs.length} Entries):**\n• Total Rejected: **${grandTtl} pcs** (Before Wash: **${totalBefore} pcs** | After Wash: **${totalAfter} pcs**)\n• Overall Rejection Rate: **${overallPct}**\n\n${previewLines}`
        : `🔍 **Multi-Buyer Wash Rejection Module Ready:**\n• No rejection entries recorded yet. Open **Wash Rejection** in the sidebar to log Before Wash & After Wash rejections for all buyers (` + '`XS-XXL, No Size, Percentage Upto, ERP Recv Qty`' + `).`
    };
  }

  // 1e. 5-Year Historical Memory Excel Rollup
  if (intent.domain === 'five_year_memory' && Array.isArray(params.fiveYearYearlyStats) && params.fiveYearYearlyStats.length > 0) {
    const columns = ['Year', 'Orders/Archives', 'Received (Pcs)', 'Delivered (Pcs)', '3-Shift Wash (Kg)'];
    let tOrd = 0, tRecv = 0, tDel = 0, tKg = 0;
    const sheetRows = params.fiveYearYearlyStats.map(y => {
      const ordTotal = y.ordersCount + y.archivedCount;
      tOrd += ordTotal;
      tRecv += y.receivedPcs;
      tDel += y.deliveredPcs;
      tKg += y.washKg;
      return [y.year, ordTotal, y.receivedPcs, y.deliveredPcs, Number(y.washKg.toFixed(1))];
    });

    const sheet: GeneratedExcelSheet = {
      sheetName: '5Year_ERP_Memory',
      fileName: `ERP_5Year_Memory_Report_${params.todayDate}.xlsx`,
      columns,
      rows: sheetRows,
      summaryRow: ['5-YEAR TOTAL (=SUM)', tOrd, tRecv, tDel, Number(tKg.toFixed(1))],
      formulaSummary: [
        `=SUM(5Y Orders/Archives) = ${tOrd}`,
        `=SUM(5Y Received Pcs) = ${tRecv.toLocaleString()} pcs`,
        `=SUM(5Y Delivered Pcs) = ${tDel.toLocaleString()} pcs`,
        `=SUM(5Y Wash Output) = ${Number(tKg.toFixed(1)).toLocaleString()} Kg`
      ]
    };

    const yearLines = sheetRows
      .map(r => `• **${r[0]}**: ${r[1]} Orders/Archives | Recv **${Number(r[2]).toLocaleString()} pcs** | Del **${Number(r[3]).toLocaleString()} pcs** | Wash **${Number(r[4]).toLocaleString()} Kg**`)
      .join('\n');

    return {
      hasCalculation: true,
      intent,
      sheet,
      summaryMarkdown: `🗂️ **5-Year Historical ERP Memory Rollup:**\n\n${yearLines}\n\n📊 **5-Year Cumulative Total:** **${tRecv.toLocaleString()} pcs** received | **${tDel.toLocaleString()} pcs** delivered | **${Number(tKg.toFixed(1)).toLocaleString()} Kg** washed.`
    };
  }

  const wantsExcelOrCalc =
    /excel|xlsx|sheet|spreadsheet|sum|total|average|avg|percent|%|achievement|variance|balance|calculate|calc|hisab|হিসাব|যোগ|গড়/i.test(qLower);

  const wantsShift = /shift|belly|yilmak|acidwash|batch|kg/i.test(qLower);
  const wantsBuyer = /buyer|rollup|consolidated|next|h&m|hm|cotton|j&j/i.test(qLower);

  // 2. Shift A/B/C Excel Calculation Sheet
  if (wantsExcelOrCalc && wantsShift && Array.isArray(params.shiftReports) && params.shiftReports.length > 0) {
    const columns = [
      'Date',
      'Shift',
      'M/C No.',
      'Operator',
      'Dyeing (B)',
      'Dyeing (Pcs)',
      'Neutral/Heavy (B)',
      'Neutral/Heavy (Pcs)',
      'AcidWash (B)',
      'AcidWash (Pcs)',
      'Weight (Kg)',
      'Remarks'
    ];
    const sheetRows: (string | number)[][] = [];
    let tDB = 0, tDP = 0, tNB = 0, tNP = 0, tAB = 0, tAP = 0, tKg = 0;

    for (const sr of params.shiftReports.slice(0, 6)) {
      const mRows = Array.isArray(sr.rows) ? sr.rows : [];
      for (const r of mRows) {
        const db = Number(r.dyeingBatch) || 0;
        const dp = Number(r.dyeingPcs) || 0;
        const nb = Number(r.neutralHeavyBatch) || 0;
        const np = Number(r.neutralHeavyPcs) || 0;
        const ab = Number(r.acidWashBatch) || 0;
        const ap = Number(r.acidWashPcs) || 0;
        const kg = Number(r.weightKg) || 0;
        if (db + dp + nb + np + ab + ap + kg === 0 && !String(r.remarks || '').trim()) continue;

        tDB += db; tDP += dp; tNB += nb; tNP += np; tAB += ab; tAP += ap; tKg += kg;
        sheetRows.push([
          sr.date || params.todayDate,
          `Shift ${sr.shift}`,
          r.mcNo || '',
          r.operatorName || '',
          db, dp, nb, np, ab, ap, kg,
          r.remarks || ''
        ]);
      }
    }

    if (sheetRows.length > 0) {
      const totalTargetKg = params.shiftReports.slice(0, 6).reduce((s, sr) => s + (Number(sr.targetKg) || 2500), 0);
      const achPct = totalTargetKg > 0 ? Number(((tKg / totalTargetKg) * 100).toFixed(1)) : 0;

      const sheet: GeneratedExcelSheet = {
        sheetName: 'Wash_3Shift_Calc',
        fileName: `Wash_3Shift_Excel_Calc_${params.todayDate}.xlsx`,
        columns,
        rows: sheetRows,
        summaryRow: ['TOTAL', '=COUNT()', `${sheetRows.length} Active Rows`, '', tDB, tDP, tNB, tNP, tAB, tAP, Number(tKg.toFixed(1)), `Achievement: ${achPct}%`],
        formulaSummary: [
          `=SUM(Weight Kg) = ${Number(tKg.toFixed(1))} Kg`,
          `=SUM(Total Batches) = ${tDB + tNB + tAB} Batches`,
          `=SUM(Total Pcs) = ${tDP + tNP + tAP} Pcs`,
          `=PCT(TotalKg, TargetKg) = ${achPct}%`
        ]
      };

      return {
        hasCalculation: true,
        sheet,
        summaryMarkdown: `📊 **Excel 3-Shift Calculation (${sheetRows.length} Machine Entries):**\n• Total Weight: **${Number(tKg.toFixed(1))} Kg** (Target Achievement: **${achPct}%**)\n• Neutral/Heavy: **${tNB} Batch / ${tNP} Pcs** | AcidWash: **${tAB} Batch / ${tAP} Pcs** | Dyeing: **${tDB} Batch / ${tDP} Pcs**\n• Download ready below (.xlsx)`
      };
    }
  }

  // 3. Buyer Rollup or General Active Order Excel Sheet
  if (wantsExcelOrCalc || wantsBuyer) {
    if (Array.isArray(params.buyerRollup) && params.buyerRollup.length > 0 && (wantsBuyer || !/file|style|111/i.test(qLower))) {
      const columns = ['Buyer', 'Active Orders', 'Order Qty (Pcs)', 'Today Sew/Recv', 'Total Recv', 'Total Delivered', 'WIP On Floor', 'Delivery %'];
      let sOrders = 0, sOrdQty = 0, sToday = 0, sRecv = 0, sDel = 0, sWip = 0;

      const sheetRows = params.buyerRollup.map(b => {
        const pct = b.order_qty > 0 ? Number(((b.total_delivered / b.order_qty) * 100).toFixed(1)) : 0;
        sOrders += b.orders;
        sOrdQty += b.order_qty;
        sToday += b.today_received;
        sRecv += b.total_received;
        sDel += b.total_delivered;
        sWip += b.wip;
        return [b.buyer, b.orders, b.order_qty, b.today_received, b.total_received, b.total_delivered, b.wip, `${pct}%`];
      });

      const overallPct = sOrdQty > 0 ? Number(((sDel / sOrdQty) * 100).toFixed(1)) : 0;
      const sheet: GeneratedExcelSheet = {
        sheetName: 'Buyer_Summary_Calc',
        fileName: `ERP_Buyer_Calculation_${params.todayDate}.xlsx`,
        columns,
        rows: sheetRows,
        summaryRow: ['TOTAL (=SUM)', sOrders, sOrdQty, sToday, sRecv, sDel, sWip, `${overallPct}%`],
        formulaSummary: [
          `=SUM(Order Qty) = ${sOrdQty.toLocaleString()} pcs`,
          `=SUM(Today Sew/Recv) = ${sToday.toLocaleString()} pcs`,
          `=SUM(Total Recv) = ${sRecv.toLocaleString()} pcs`,
          `=SUM(Total Delivered) = ${sDel.toLocaleString()} pcs`,
          `=SUM(WIP) = ${sWip.toLocaleString()} pcs`,
          `=PCT(Delivered, OrderQty) = ${overallPct}%`
        ]
      };

      return {
        hasCalculation: true,
        sheet,
        summaryMarkdown: `📊 **Excel Buyer Calculation Rollup (${params.todayDate}):**\n• Total Order Qty: **${sOrdQty.toLocaleString()} pcs**\n• Today Sew/Recv: **${sToday.toLocaleString()} pcs** | Total Recv: **${sRecv.toLocaleString()} pcs**\n• Total Delivered: **${sDel.toLocaleString()} pcs** (**${overallPct}%**) | Current WIP: **${sWip.toLocaleString()} pcs**`
      };
    }

    if (Array.isArray(params.ordersSummary) && params.ordersSummary.length > 0) {
      const columns = ['File No', 'Buyer', 'Style', 'Color', 'Order Qty', 'Today Recv', 'Total Recv', 'Total Del', 'WIP', 'Progress %'];
      let sOrd = 0, sToday = 0, sRecv = 0, sDel = 0, sWip = 0;

      const sheetRows = params.ordersSummary.slice(0, 50).map(o => {
        const pct = o.order_qty > 0 ? Number(((o.total_delivered_qty / o.order_qty) * 100).toFixed(1)) : 0;
        sOrd += o.order_qty;
        sToday += o.today_received_qty;
        sRecv += o.total_received_qty;
        sDel += o.total_delivered_qty;
        sWip += o.wip_on_floor_qty;
        return [o.file_no || o.id, o.buyer, o.style_no, o.color, o.order_qty, o.today_received_qty, o.total_received_qty, o.total_delivered_qty, o.wip_on_floor_qty, `${pct}%`];
      });

      const overallPct = sOrd > 0 ? Number(((sDel / sOrd) * 100).toFixed(1)) : 0;
      const sheet: GeneratedExcelSheet = {
        sheetName: 'ERP_Order_Calculations',
        fileName: `ERP_Order_Calculation_${params.todayDate}.xlsx`,
        columns,
        rows: sheetRows,
        summaryRow: ['TOTAL (=SUM)', `${sheetRows.length} Orders`, '', '', sOrd, sToday, sRecv, sDel, sWip, `${overallPct}%`],
        formulaSummary: [
          `=SUM(Order Qty) = ${sOrd.toLocaleString()} pcs`,
          `=SUM(Today Sew/Recv) = ${sToday.toLocaleString()} pcs`,
          `=SUM(Total Recv) = ${sRecv.toLocaleString()} pcs`,
          `=SUM(WIP) = ${sWip.toLocaleString()} pcs`
        ]
      };

      return {
        hasCalculation: true,
        sheet,
        summaryMarkdown: `📊 **Excel Order Calculation (${sheetRows.length} Orders):**\n• Total Order Qty: **${sOrd.toLocaleString()} pcs** | Today Sew/Recv: **${sToday.toLocaleString()} pcs**\n• Total Recv: **${sRecv.toLocaleString()} pcs** | Delivered: **${sDel.toLocaleString()} pcs** (**${overallPct}%**) | WIP: **${sWip.toLocaleString()} pcs**`
      };
    }
  }

  return { hasCalculation: false, summaryMarkdown: '' };
}

export const DEFAULT_SUPPORT_KNOWLEDGE: SupportKnowledgeRule[] = [
  {
    id: 'skill-sew-mapping',
    trigger: 'sew, sewing input, sew hoise, receive, recv',
    ruleText: '"Sew hoise" / Sewing input maps to received_qty in daily_logs. Always show both Today (Dhaka date) and Cumulative Total pcs.',
    category: 'terminology',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  {
    id: 'skill-excel-formulas',
    trigger: 'excel, sum, average, min, max, pct, percent, calculation, formula, chem, bdot, bdwage, eff, knitcons',
    ruleText: 'Use the inbuilt deterministic Excel Calculation Engine (=SUM, =AVERAGE, =PCT, =ROUND, =CHEM, =OWG, =BDOT, =BDWAGE, =EFF, =KNITCONS) and generate downloadable .xlsx summary sheets.',
    category: 'formula',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  {
    id: 'skill-3shift-wash',
    trigger: 'shift, shift a, shift b, shift c, belly, yilmak, acidwash, kg',
    ruleText: 'Wash Unit runs 3 Shifts: Shift A (6:00 AM - 02:00 PM), Shift B (2:00 PM - 10:00 PM), Shift C (10:00 PM - 6:00 AM). Weight is tracked in Kg and Batches/Pcs per machine.',
    category: 'terminology',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  ...INDUSTRIAL_SUPPORT_KNOWLEDGE
];
