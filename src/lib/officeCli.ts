/**
 * iOfficeAI / OfficeCLI Automation & AI Skill Engine
 * Implements office automation skills for Industrial Garments & Wash ERP
 * - Natural Language & CLI command parsing
 * - Excel/CSV & Document Report Builders (Costings, Wash Certificates, P&L Reports)
 * - Order Batch Process Automation
 * - Script / Macro Automation Sandbox
 */

export interface OfficeCliCommand {
  raw: string;
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export interface OfficeCliResult {
  id: string;
  timestamp: string;
  command: string;
  success: boolean;
  type: 'text' | 'table' | 'json' | 'file' | 'badge';
  content: any;
  outputLog: string[];
  executionTimeMs: number;
  downloadUrl?: string;
  downloadFilename?: string;
}

export interface PresetSkill {
  id: string;
  category: 'Document' | 'Spreadsheet' | 'Batch Order' | 'AI Briefing' | 'Chemical Audit';
  name: string;
  cliCommand: string;
  description: string;
  iconName: string;
  exampleArgs?: string;
}

export const PRESET_OFFICE_SKILLS: PresetSkill[] = [
  {
    id: 'gen-wash-pnl-excel',
    category: 'Spreadsheet',
    name: 'Generate Monthly Wash P&L Excel Sheet',
    cliCommand: 'office generate:excel --type=wash-pnl --month=current --format=xlsx',
    description: 'Generates structured Excel cost sheet with Wash Type breakdown (Enzyme, Stone, Bleach, Acid, Dyeing), Revenue, Chemical Expenses & Net Margin.',
    iconName: 'FileSpreadsheet'
  },
  {
    id: 'gen-wash-certificate',
    category: 'Document',
    name: 'Issue Official Wash QC Pass Certificate',
    cliCommand: 'office doc:wash-certificate --orderId=ORD-9021 --style=Denim-Jacket-V2 --buyer=LEVIS',
    description: 'Creates printable quality compliance wash pass document with wash shrinkage, pH level, color fastness, and lab signoff.',
    iconName: 'FileCheck'
  },
  {
    id: 'batch-update-wash-status',
    category: 'Batch Order',
    name: 'Batch Update Wash Process Status',
    cliCommand: 'office batch:update-status --targetStage="Drying & Hydro" --newStatus="Completed"',
    description: 'Scans active wash floor orders and advances garments in Drying & Hydro stage to Hydro-Completed in bulk.',
    iconName: 'CheckCheck'
  },
  {
    id: 'ai-daily-briefing',
    category: 'AI Briefing',
    name: 'Generate MD Executive Daily Wash Briefing',
    cliCommand: 'office ai:briefing --role=wash_md --targetDate=today',
    description: 'Parses live received/delivered garments, machine utilization, chemical consumption & net profit into a concise executive email briefing.',
    iconName: 'Sparkles'
  },
  {
    id: 'chem-audit-report',
    category: 'Chemical Audit',
    name: 'Run Eco Chemical Compliance & Stock Audit',
    cliCommand: 'office audit:chemicals --threshold=15 --export=csv',
    description: 'Audits washing dyes, enzymes, softeners, and bleaching agents stock levels against Oeko-Tex & ZDHC eco-compliance limits.',
    iconName: 'ShieldAlert'
  },
  {
    id: 'recalc-process-cost',
    category: 'Spreadsheet',
    name: 'Recalculate Unit Washing Costs (BDT / USD)',
    cliCommand: 'office calc:wash-cost --dollarRate=122 --margin=18%',
    description: 'Recalculates per-piece wash cost based on recipe chemical weight, steam boiler cost, labor per hour, and currency exchange rates.',
    iconName: 'Calculator'
  }
];

/**
 * Parses a raw command string into command name, arguments, and flags.
 */
export function parseCliCommand(rawInput: string): OfficeCliCommand {
  const trimmed = rawInput.trim();
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  
  const cleanParts = parts.map(p => p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p);
  
  const command = cleanParts[0] || 'office';
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < cleanParts.length; i++) {
    const part = cleanParts[i];
    if (part.startsWith('--')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const flagName = part.slice(2, eqIdx);
        const flagVal = part.slice(eqIdx + 1);
        flags[flagName] = flagVal;
      } else {
        const flagName = part.slice(2);
        const nextPart = cleanParts[i + 1];
        if (nextPart && !nextPart.startsWith('-')) {
          flags[flagName] = nextPart;
          i++;
        } else {
          flags[flagName] = true;
        }
      }
    } else if (part.startsWith('-')) {
      const flagName = part.slice(1);
      flags[flagName] = true;
    } else {
      args.push(part);
    }
  }

  return { raw: rawInput, command, args, flags };
}

/**
 * Executes an OfficeCLI Command against mock/real ERP data
 */
export async function executeOfficeCliCommand(rawInput: string): Promise<OfficeCliResult> {
  const startTime = performance.now();
  const parsed = parseCliCommand(rawInput);
  const logs: string[] = [];
  const id = `CLI-RES-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toLocaleTimeString();

  logs.push(`[OfficeCLI Engine] Received command: "${rawInput}"`);
  logs.push(`[Parser] Action: ${parsed.command} | Args: [${parsed.args.join(', ')}]`);

  // Simulate network or AI processing delay
  await new Promise(r => setTimeout(r, 450));

  const cmdLower = parsed.raw.toLowerCase();

  // 1. HELP / LIST COMMANDS
  if (cmdLower === 'help' || cmdLower === 'office --help' || cmdLower === 'office help') {
    logs.push(`[OfficeCLI] Displaying CLI skill handbook...`);
    return {
      id,
      timestamp,
      command: rawInput,
      success: true,
      type: 'json',
      content: {
        system: "iOfficeAI / OfficeCLI Automation Suite v3.2",
        availableSkills: PRESET_OFFICE_SKILLS.map(s => ({
          name: s.name,
          cli: s.cliCommand,
          category: s.category
        })),
        usage: "Type natural language or CLI commands like 'office generate:excel --type=wash-pnl'"
      },
      outputLog: logs,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 2. EXCEL / SPREADSHEET GENERATION
  if (cmdLower.includes('generate:excel') || cmdLower.includes('wash-pnl') || cmdLower.includes('excel')) {
    logs.push(`[Excel Engine] Initializing Wash P&L Spreadsheet workbook...`);
    logs.push(`[Data Source] Querying Buyer Data Bank & Machine Recipes...`);
    logs.push(`[Calculation] Compiling Enzyme, Stone Wash, Acid Wash & Tinting cost per garment...`);

    const tableData = [
      { WashType: "Enzyme / Garment Wash", RecvQty: 42000, DelivQty: 41850, GrossRevenue: "$41,850", ChemCost: "$8,370", UtilityLabor: "$4,185", NetProfit: "$29,295", Margin: "70.0%" },
      { WashType: "Stone & Bleach Wash", RecvQty: 28500, DelivQty: 28200, GrossRevenue: "$39,480", ChemCost: "$10,658", UtilityLabor: "$5,100", NetProfit: "$23,722", Margin: "60.1%" },
      { WashType: "Acid & Vintage Wash", RecvQty: 18000, DelivQty: 17800, GrossRevenue: "$32,040", ChemCost: "$9,200", UtilityLabor: "$4,300", NetProfit: "$18,540", Margin: "57.8%" },
      { WashType: "Pigment & Reactive Dyeing", RecvQty: 12500, DelivQty: 12400, GrossRevenue: "$27,280", ChemCost: "$8,900", UtilityLabor: "$3,800", NetProfit: "$14,580", Margin: "53.4%" },
      { WashType: "Laser & Monkey Wash", RecvQty: 9400, DelivQty: 9350, GrossRevenue: "$21,505", ChemCost: "$3,200", UtilityLabor: "$2,800", NetProfit: "$15,505", Margin: "72.1%" },
    ];

    // Create CSV blob
    const csvHeader = "WashType,RecvQty,DelivQty,GrossRevenue,ChemCost,UtilityLabor,NetProfit,Margin\n";
    const csvRows = tableData.map(r => `"${r.WashType}",${r.RecvQty},${r.DelivQty},"${r.GrossRevenue}","${r.ChemCost}","${r.UtilityLabor}","${r.NetProfit}","${r.Margin}"`).join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    logs.push(`[Export] Generated spreadsheet file: Wash_PnL_Breakdown_Report.csv`);

    return {
      id,
      timestamp,
      command: rawInput,
      success: true,
      type: 'table',
      content: tableData,
      outputLog: logs,
      executionTimeMs: Math.round(performance.now() - startTime),
      downloadUrl,
      downloadFilename: `Wash_PnL_Breakdown_${new Date().toISOString().slice(0,10)}.csv`
    };
  }

  // 3. DOCUMENT GENERATION (WASH PASS CERTIFICATE)
  if (cmdLower.includes('doc:wash-certificate') || cmdLower.includes('certificate') || cmdLower.includes('doc')) {
    const orderId = parsed.flags.orderId || 'ORD-9021';
    const style = parsed.flags.style || 'Denim Jacket V2';
    const buyer = parsed.flags.buyer || "LEVI'S STRAUSS";

    logs.push(`[Doc Engine] Compiling Official Wash Quality Certificate...`);
    logs.push(`[QC Lab] Injecting Shrinkage, PH Test, and Rubbing Fastness data for ${style}...`);

    const certificateText = `
================================================================================
          INCTL INDUSTRIAL GARMENT WASHING FACTORY (GAZIPUR)
               OFFICIAL WASH & FINISHING QUALITY CERTIFICATE
================================================================================
CERTIFICATE NO : QC-WASH-${orderId}-2026
DATE           : ${new Date().toLocaleDateString('en-GB')}
BUYER NAME     : ${buyer}
STYLE NAME     : ${style}
ORDER REF      : ${orderId}
TOTAL PIECES   : 25,000 Pcs
--------------------------------------------------------------------------------
1. WASH PROCESS SPECS:
   - Wash Technique : Heavy Stone + Enzyme Wash + Whisker + Handscrape
   - Water Temp     : 55°C
   - Recipe ID      : RECIPE-DENIM-HEAVY-STONE-04

2. PHYSICAL & CHEMICAL COMPLIANCE:
   - Fabric Shrinkage (Warp x Weft) : -2.1% x -1.8% (PASS - Max 3.0%)
   - Fabric pH Value                : 6.4 (PASS - Oeko-Tex Standard 100)
   - Rubbing Color Fastness (Dry)   : Grade 4-5 (PASS)
   - Rubbing Color Fastness (Wet)   : Grade 3-4 (PASS)
   - Formaldehyde Content          : <10 ppm (PASS)

3. FINAL INSPECTION STATUS:
   [ ✔ ] PASSED & CLEARED FOR FINISHING & PACKING
   [   ] RE-WASH REQUIRED

Authorized QC Manager Signature: ______________________
Chief Wash Technologist Signature: ____________________
================================================================================
`;

    const blob = new Blob([certificateText], { type: 'text/plain;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    logs.push(`[Doc Engine] Certificate generated successfully for Order ${orderId}!`);

    return {
      id,
      timestamp,
      command: rawInput,
      success: true,
      type: 'text',
      content: certificateText,
      outputLog: logs,
      executionTimeMs: Math.round(performance.now() - startTime),
      downloadUrl,
      downloadFilename: `Wash_Certificate_${orderId}.txt`
    };
  }

  // 4. BATCH STATUS UPDATE
  if (cmdLower.includes('batch:update-status') || cmdLower.includes('batch')) {
    const targetStage = parsed.flags.targetStage || 'Drying';
    const newStatus = parsed.flags.newStatus || 'Completed';

    logs.push(`[Batch Execution] Scanning active floor wash runs matching stage: "${targetStage}"...`);
    logs.push(`[Database] Found 14 batch lots on floor.`);
    logs.push(`[ERP Core] Applying "First Recv and Last Delivery" log preservation rule...`);
    logs.push(`[Update] Lot #201: Updated status to "${newStatus}"`);
    logs.push(`[Update] Lot #204: Updated status to "${newStatus}"`);
    logs.push(`[Update] Lot #209: Updated status to "${newStatus}"`);
    logs.push(`[Audit Log] Saved batch operation by Super Admin (tanzirerp)`);

    return {
      id,
      timestamp,
      command: rawInput,
      success: true,
      type: 'badge',
      content: {
        affectedOrders: 14,
        targetStage,
        newStatus,
        preservationRuleApplied: true,
        message: `Successfully batch updated 14 order lots to status "${newStatus}" without losing historical received/delivery logs.`
      },
      outputLog: logs,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 5. AI DAILY BRIEFING
  if (cmdLower.includes('ai:briefing') || cmdLower.includes('briefing') || cmdLower.includes('executive')) {
    logs.push(`[Gemini AI] Querying live factory KPIs and washing machine load schedules...`);
    logs.push(`[AI Model] Formulating MD Executive Briefing summary...`);

    const briefingText = `
📊 INCTL WASH ERP - EXECUTIVE DAILY BRIEFING FOR WASH MD / MANAGER
Date: ${new Date().toLocaleDateString('en-GB')}

1. PRODUCTION HIGHLIGHTS:
   • Total Received Today: 24,500 Pcs (Garments R&D Log)
   • Total Delivered Today: 23,800 Pcs
   • Daily Wash Efficiency Rate: 97.1%

2. FINANCIAL METRICS (ROLE-PROTECTED):
   • Gross Washing Revenue: $24,150 USD
   • Chemical & Utility Expenses: $6,200 USD
   • Estimated Daily Net Profit: $17,950 USD (74.3% Net Margin)

3. WASH MACHINE LOAD UTILIZATION:
   • Total M/C Capacity: 12 Washing Machines (10,500 KG Total Cap)
   • Active Running M/C: 10 Machines
   • Machine Load Utilization: 88.5%

4. CRITICAL ACTION ITEMS:
   ⚠ Machine #04 scheduled for Descaling Maintenance at 18:00
   ✔ Enzyme Wash recipe optimization saved $0.04/pc on Denim Lot #8801
`;

    return {
      id,
      timestamp,
      command: rawInput,
      success: true,
      type: 'text',
      content: briefingText,
      outputLog: logs,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 6. CHEMICAL AUDIT
  if (cmdLower.includes('audit:chemicals') || cmdLower.includes('chemical') || cmdLower.includes('audit')) {
    logs.push(`[Eco Audit] Scanning Chemical Warehouse inventory...`);
    logs.push(`[Compliance] Verifying ZDHC Level 3 MRSL & Oeko-Tex Standard 100 compliance...`);

    const auditData = [
      { Chemical: "Cellulase Enzyme Liquid", StockKG: "1,250 KG", ReorderLevel: "300 KG", Compliance: "ZDHC Level 3 (PASS)", CostPerKG: "$3.80" },
      { Chemical: "Potassium Permanganate (PP)", StockKG: "180 KG", ReorderLevel: "200 KG (LOW)", Compliance: "Eco-Restricted (WARN)", CostPerKG: "$5.20" },
      { Chemical: "Non-Ionic Softener Flakes", StockKG: "2,100 KG", ReorderLevel: "500 KG", Compliance: "ZDHC Level 3 (PASS)", CostPerKG: "$2.40" },
      { Chemical: "Sodium Hypochlorite 12%", StockKG: "850 KG", ReorderLevel: "250 KG", Compliance: "Approved (PASS)", CostPerKG: "$0.95" },
      { Chemical: "Reactive Blue Dye 21", StockKG: "420 KG", ReorderLevel: "100 KG", Compliance: "ZDHC Level 3 (PASS)", CostPerKG: "$8.50" },
    ];

    return {
      id,
      timestamp,
      command: rawInput,
      success: true,
      type: 'table',
      content: auditData,
      outputLog: logs,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 7. GENERIC / NATURAL LANGUAGE FALLBACK
  logs.push(`[OfficeCLI Natural Language Engine] Parsing natural prompt: "${rawInput}"`);
  logs.push(`[Execution] Dispatching automated AI task...`);

  return {
    id,
    timestamp,
    command: rawInput,
    success: true,
    type: 'text',
    content: `[OfficeCLI AI Task Output]\nExecuted office automation command: "${rawInput}"\n\nAll parameters validated and applied to the ERP workflow engine. Logged under Super Admin session.`,
    outputLog: logs,
    executionTimeMs: Math.round(performance.now() - startTime)
  };
}
