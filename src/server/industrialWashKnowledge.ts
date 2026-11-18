/**
 * Inbuilt Industrial Wash Chemical, Garment Consumption/Costing,
 * Bangladesh (BD) Labor Law & HR Rules, and Smart Intent Capture Engine.
 */

export interface SupportKnowledgeRule {
  id: string;
  trigger: string;
  ruleText: string;
  category: 'formula' | 'terminology' | 'buyer_rule' | 'correction' | 'chemical' | 'garment' | 'bd_hr' | 'memory';
  confidenceScore: number;
  usageCount: number;
  createdBy: string;
  createdAt: string;
}

export interface GeneratedExcelSheet {
  sheetName: string;
  fileName: string;
  columns: string[];
  rows: (string | number)[][];
  summaryRow?: (string | number)[];
  formulaSummary: string[];
}

export interface CapturedIntent {
  normalizedQuery: string;
  domain:
    | 'wash_chemical'
    | 'garment_consumption'
    | 'bd_labor_hr'
    | 'wash_rejection'
    | 'five_year_memory'
    | 'erp_order'
    | 'shift_production'
    | 'buyer_summary'
    | 'general';
  keywords: string[];
  numbers: {
    kg?: number;
    pcs?: number;
    gsm?: number;
    basicSalary?: number;
    grossSalary?: number;
    otHours?: number;
    workers?: number;
    sam?: number;
    efficiencyPct?: number;
    liquorRatio?: number;
    years?: number;
    lengthCm?: number;
    chestCm?: number;
    wastagePct?: number;
    targetYear?: number;
    rawNumbers: number[];
  };
}

interface ChemicalRecipeItem {
  chemical: string;
  stage: string;
  dosageType: 'g/L' | '% o.w.g.';
  dosageValue: number;
  unitPriceBdtPerKg: number;
  tempC: string;
  timeMin: string;
}

interface WashRecipeTemplate {
  key: string;
  name: string;
  aliases: RegExp;
  defaultLiquorRatio: number; // e.g. 8 => 1:8
  waterLitersPerKg: number;
  phRange: string;
  processNotes: string;
  items: ChemicalRecipeItem[];
}

const WASH_RECIPES: WashRecipeTemplate[] = [
  {
    key: 'desizing',
    name: 'Industrial Desizing Wash',
    aliases: /\b(desize|desizing|de-size|starch remove|amylase)\b/i,
    defaultLiquorRatio: 8,
    waterLitersPerKg: 24,
    phRange: '5.5 – 6.5',
    processNotes: 'Remove warp size/starch cleanly before enzyme or bleach.',
    items: [
      { chemical: 'Alpha Amylase Enzyme (Desizing)', stage: 'Desize Bath', dosageType: 'g/L', dosageValue: 1.0, unitPriceBdtPerKg: 420, tempC: '60°C', timeMin: '20m' },
      { chemical: 'Non-Ionic Wetting Agent / Detergent', stage: 'Desize Bath', dosageType: 'g/L', dosageValue: 0.8, unitPriceBdtPerKg: 260, tempC: '60°C', timeMin: '20m' },
      { chemical: 'Acetic Acid (pH Buffer)', stage: 'Desize Bath', dosageType: 'g/L', dosageValue: 0.5, unitPriceBdtPerKg: 145, tempC: '60°C', timeMin: '20m' },
      { chemical: 'Sequestering Agent (Chelate)', stage: 'Desize Bath', dosageType: 'g/L', dosageValue: 0.5, unitPriceBdtPerKg: 230, tempC: '60°C', timeMin: '20m' }
    ]
  },
  {
    key: 'enzyme',
    name: 'Enzyme / Bio-Polishing Wash',
    aliases: /\b(enzyme|bio-?polish|cellulase|neutral wash|newtral)\b/i,
    defaultLiquorRatio: 8,
    waterLitersPerKg: 35,
    phRange: '4.5 – 5.5 (Acid) / 6.5 – 7.0 (Neutral)',
    processNotes: 'Cellulase abrades surface fuzz/color cleanly; control backstaining with anti-backstain.',
    items: [
      { chemical: 'Acid / Neutral Cellulase Enzyme', stage: 'Enzyme Bath', dosageType: '% o.w.g.', dosageValue: 1.5, unitPriceBdtPerKg: 680, tempC: '55°C', timeMin: '40m' },
      { chemical: 'Anti-Backstaining Agent (Dispersion)', stage: 'Enzyme Bath', dosageType: 'g/L', dosageValue: 0.8, unitPriceBdtPerKg: 340, tempC: '55°C', timeMin: '40m' },
      { chemical: 'Acetic Acid (pH Adjust)', stage: 'Enzyme Bath', dosageType: 'g/L', dosageValue: 0.6, unitPriceBdtPerKg: 145, tempC: '55°C', timeMin: '40m' },
      { chemical: 'Soda Ash (Enzyme Deactivation)', stage: 'Kill / Rinse', dosageType: 'g/L', dosageValue: 1.0, unitPriceBdtPerKg: 58, tempC: '70°C', timeMin: '10m' },
      { chemical: 'Cationic / Silicone Softener', stage: 'Final Softening', dosageType: '% o.w.g.', dosageValue: 2.0, unitPriceBdtPerKg: 310, tempC: '40°C', timeMin: '15m' }
    ]
  },
  {
    key: 'stone',
    name: 'Stone Wash (Pumice + Heavy Enzyme)',
    aliases: /\b(stone wash|stonewash|heavy wash|pumice|belly wash)\b/i,
    defaultLiquorRatio: 7,
    waterLitersPerKg: 48,
    phRange: '5.5 – 6.8',
    processNotes: 'Standard pumice stone load ratio is 1:1.0 to 1:1.2 kg stone per kg denim.',
    items: [
      { chemical: 'Neutral Cellulase Enzyme', stage: 'Stone Bath', dosageType: '% o.w.g.', dosageValue: 2.0, unitPriceBdtPerKg: 680, tempC: '55°C', timeMin: '45m' },
      { chemical: 'Pumice Stone Abrasion (Consumable)', stage: 'Stone Bath', dosageType: '% o.w.g.', dosageValue: 100.0, unitPriceBdtPerKg: 45, tempC: '55°C', timeMin: '45m' },
      { chemical: 'Anti-Backstaining Agent', stage: 'Stone Bath', dosageType: 'g/L', dosageValue: 1.0, unitPriceBdtPerKg: 340, tempC: '55°C', timeMin: '45m' },
      { chemical: 'Silicone Micro-Emulsion Softener', stage: 'Softening', dosageType: '% o.w.g.', dosageValue: 2.0, unitPriceBdtPerKg: 360, tempC: '40°C', timeMin: '15m' }
    ]
  },
  {
    key: 'acid_wash',
    name: 'Acid Wash / Snow Wash (KMnO4 + Pumice)',
    aliases: /\b(acid wash|acidwash|snow wash|kmno4|permanganate|acid)\b/i,
    defaultLiquorRatio: 6,
    waterLitersPerKg: 42,
    phRange: 'Neutralize to pH 6.5 – 7.0',
    processNotes: 'Dry-tumble pumice soaked in KMnO4 + Phosphoric Acid, then mandatory Sodium Metabisulfite neutralization.',
    items: [
      { chemical: 'Potassium Permanganate (KMnO4)', stage: 'Acid/Stone Soak', dosageType: '% o.w.g.', dosageValue: 2.5, unitPriceBdtPerKg: 520, tempC: 'Room Temp', timeMin: '18m' },
      { chemical: 'Phosphoric Acid (85%) / Activator', stage: 'Acid/Stone Soak', dosageType: '% o.w.g.', dosageValue: 1.0, unitPriceBdtPerKg: 240, tempC: 'Room Temp', timeMin: '18m' },
      { chemical: 'Sodium Metabisulfite (SMBS Neutralizer)', stage: 'Neutralization', dosageType: 'g/L', dosageValue: 3.0, unitPriceBdtPerKg: 115, tempC: '45°C', timeMin: '15m' },
      { chemical: 'Hydrogen Peroxide (H2O2 50%)', stage: 'Clearance Rinse', dosageType: 'g/L', dosageValue: 1.5, unitPriceBdtPerKg: 110, tempC: '50°C', timeMin: '12m' },
      { chemical: 'Cationic Softener', stage: 'Final Softening', dosageType: '% o.w.g.', dosageValue: 1.8, unitPriceBdtPerKg: 310, tempC: '40°C', timeMin: '15m' }
    ]
  },
  {
    key: 'bleach',
    name: 'Bleach Wash (Hypochlorite + Antichlor)',
    aliases: /\b(bleach|hypo|chlorine|super white|light indigo)\b/i,
    defaultLiquorRatio: 8,
    waterLitersPerKg: 45,
    phRange: '10.5 – 11.2 (Bleach) -> 6.5 (Neutral)',
    processNotes: 'Always neutralize residual chlorine with Sodium Thiosulfate / H2O2 before softening.',
    items: [
      { chemical: 'Sodium Hypochlorite (Bleach 10-12%)', stage: 'Bleach Bath', dosageType: 'g/L', dosageValue: 5.0, unitPriceBdtPerKg: 55, tempC: '50°C', timeMin: '15m' },
      { chemical: 'Soda Ash (Alkali pH 10.8)', stage: 'Bleach Bath', dosageType: 'g/L', dosageValue: 1.5, unitPriceBdtPerKg: 58, tempC: '50°C', timeMin: '15m' },
      { chemical: 'Sodium Thiosulfate (Anti-Chlor Neutralizer)', stage: 'Neutralization', dosageType: 'g/L', dosageValue: 2.5, unitPriceBdtPerKg: 95, tempC: '45°C', timeMin: '12m' },
      { chemical: 'Hydrogen Peroxide (H2O2 50%)', stage: 'Anti-Yellowing', dosageType: 'g/L', dosageValue: 1.0, unitPriceBdtPerKg: 110, tempC: '50°C', timeMin: '10m' },
      { chemical: 'OBA (Optical Brightener) + Softener', stage: 'Finish Bath', dosageType: '% o.w.g.', dosageValue: 1.8, unitPriceBdtPerKg: 390, tempC: '40°C', timeMin: '15m' }
    ]
  },
  {
    key: 'dyeing',
    name: 'Garment Dyeing (Reactive / Direct)',
    aliases: /\b(dyeing|garment dye|reactive dye|pigment dye|tint)\b/i,
    defaultLiquorRatio: 10,
    waterLitersPerKg: 65,
    phRange: '10.5 – 11.5 (Fixation) -> 5.5 (Neutral)',
    processNotes: 'High salt exhaustion + alkali fixation followed by hot soaping and dye fixing agent.',
    items: [
      { chemical: 'Reactive / Pigment Dyestuff (Medium Shade)', stage: 'Dyeing Bath', dosageType: '% o.w.g.', dosageValue: 2.0, unitPriceBdtPerKg: 1150, tempC: '60°C', timeMin: '45m' },
      { chemical: 'Glauber Salt / Common Salt', stage: 'Dyeing Bath', dosageType: 'g/L', dosageValue: 40.0, unitPriceBdtPerKg: 28, tempC: '60°C', timeMin: '30m' },
      { chemical: 'Soda Ash (Alkali Fixer)', stage: 'Fixation', dosageType: 'g/L', dosageValue: 12.0, unitPriceBdtPerKg: 58, tempC: '60°C', timeMin: '30m' },
      { chemical: 'Soaping / Washing-Off Agent', stage: 'Soaping', dosageType: 'g/L', dosageValue: 1.5, unitPriceBdtPerKg: 280, tempC: '85°C', timeMin: '15m' },
      { chemical: 'Formaldehyde-Free Dye Fixing Agent', stage: 'Fixing Bath', dosageType: '% o.w.g.', dosageValue: 2.0, unitPriceBdtPerKg: 350, tempC: '45°C', timeMin: '15m' }
    ]
  },
  {
    key: 'resin_softener',
    name: 'Resin 3D / Crinkle & Softening Finish',
    aliases: /\b(resin|3d|whisker|crinkle|softener|silicone|oba|pp spray|potassium)\b/i,
    defaultLiquorRatio: 6,
    waterLitersPerKg: 18,
    phRange: '4.5 – 5.5',
    processNotes: 'For 3D Resin/Crinkle apply via spray/dip, hydro-extract to 70% pickup, cure at 150°C for 12 min.',
    items: [
      { chemical: 'Zero-Formaldehyde Crosslinking Resin', stage: 'Resin Impregnation', dosageType: 'g/L', dosageValue: 75.0, unitPriceBdtPerKg: 310, tempC: 'Room Temp', timeMin: '10m' },
      { chemical: 'Magnesium Chloride (MgCl2 Catalyst)', stage: 'Resin Impregnation', dosageType: 'g/L', dosageValue: 18.0, unitPriceBdtPerKg: 130, tempC: 'Room Temp', timeMin: '10m' },
      { chemical: 'Silicone Elastomer Softener', stage: 'Finish Bath', dosageType: 'g/L', dosageValue: 20.0, unitPriceBdtPerKg: 390, tempC: '40°C', timeMin: '15m' }
    ]
  }
];

/**
 * Normalizes messy Banglish / English / phonetic floor typos so the intent engine
 * accurately understands supervisor questions.
 */
export function normalizeFloorText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\blebar\b|\blabour\b|\bworker cost\b|\bsromik\b/g, 'labor')
    .replace(/\blow\b/g, 'law')
    .replace(/\bkemikal\b|\bchemical[s]?\b|\brecipe\b|\bdosage\b/g, 'chemical')
    .replace(/\bbeton\b|\bmejuri\b|\bwages\b/g, 'salary')
    .replace(/\bchuti\b|\bleav\b/g, 'leave')
    .replace(/\bporiman\b|\bkhoroch\b|\bconsump\w*\b/g, 'consumption')
    .replace(/\bhisab\b|\bhishab\b|\bcalculate\b|\bcalc\b/g, 'calculate')
    .replace(/\bpurano\b|\bpuran\b|\bold\b|\bhistory\b|\bpast\b/g, 'history')
    .replace(/\bbochor\b|\bbotsor\b|\byear[s]?\b/g, 'years')
    .replace(/\bmajuri\b/g, 'wage');
}

export function captureUserIntentAndEntities(rawQuery: string): CapturedIntent {
  const normalizedQuery = normalizeFloorText(rawQuery);
  const rawNumbers = (rawQuery.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => Number.isFinite(n));

  const extractUnitNum = (regex: RegExp): number | undefined => {
    const m = rawQuery.match(regex);
    if (!m) return undefined;
    const val = Number(m[1] || m[2]);
    return Number.isFinite(val) ? val : undefined;
  };

  const kg = extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:kg|kilogram|kgs)\b/i);
  const pcs = extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:pcs|pc|pieces|piece|garments|gmts)\b/i);
  const gsm = extractUnitNum(/(\d+(?:\.\d+)?)\s*gsm\b/i) ?? extractUnitNum(/\bgsm\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const basicSalary =
    extractUnitNum(/(?:basic(?:\s+salary)?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i) ??
    extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:bdt|tk|taka)?\s*basic\b/i);
  const grossSalary =
    extractUnitNum(/(?:gross(?:\s+salary)?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i) ??
    extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:bdt|tk|taka)\s*(?:salary|gross)?\b/i);
  const otHours =
    extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|ghonta)\s*(?:ot|overtime)?/i) ??
    extractUnitNum(/(?:ot|overtime)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const workers = extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:worker|workers|manpower|operators|op)\b/i);
  const sam = extractUnitNum(/(?:sam|smv)\s*[:=]?\s*(\d+(?:\.\d+)?)/i) ?? extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:sam|smv)\b/i);
  const efficiencyPct = extractUnitNum(/(\d+(?:\.\d+)?)\s*%\s*(?:eff|efficiency)?/i);
  const liquorRatio = extractUnitNum(/(?:l:r|lr|liquor\s*ratio)\s*[:=]?\s*1\s*[:/]\s*(\d+(?:\.\d+)?)/i);
  const years = extractUnitNum(/(\d+(?:\.\d+)?)\s*(?:year|years|yr|yrs|bochor)\b/i);
  const lengthCm = extractUnitNum(/(?:len|length)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const chestCm = extractUnitNum(/(?:chest|half\s*chest)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const wastagePct = extractUnitNum(/(\d+(?:\.\d+)?)\s*%\s*wastage/i);

  const yearMatch = rawQuery.match(/\b(202[1-9]|2030)\b/);
  const targetYear = yearMatch ? Number(yearMatch[1]) : undefined;

  let domain: CapturedIntent['domain'] = 'general';
  const hasChemicalKeyword =
    /\b(chemical|enzyme|acid wash|acidwash|bleach|desize|desizing|stone wash|stonewash|kmno4|pp spray|softener|resin|dyeing|liquor ratio|o\.w\.g|recipe|soda ash|peroxide|metabisulfite)\b/i.test(
      normalizedQuery
    );
  const hasBdHrKeyword =
    /\b(bd|bangladesh|labor|worker|hr|overtime|ot|wage|salary|minimum wage|gratuity|maternity|earned leave|casual leave|sick leave|festival|eid bonus|bonus|wppf|provident|sec 108|208|compliance)\b/i.test(
      normalizedQuery
    );
  const hasGarmentKeyword =
    /\b(consumption|gsm|t-?shirt|polo|fleece|denim|woven|fabric qty|fob|cm cost|cost of making|sam|smv|efficiency|dozen|dz|all-?over|aop)\b/i.test(
      normalizedQuery
    );
  const has5YrMemoryKeyword =
    /\b(5\s*year|5\s*yr|5y|five year|last\s*\d+\s*year|history|archive|memory|cache|100\s*mb|100mb|all\s*time|yearly)\b/i.test(
      normalizedQuery
    );

  const hasRejectionKeyword =
    /\b(reject|rejection|raject|before wash|after wash|shade reject|body hole|needle cut|neddle|big spot|big sport|zipper reject|part shade|percentage upto)\b/i.test(
      normalizedQuery
    );

  if (hasChemicalKeyword) domain = 'wash_chemical';
  else if (hasRejectionKeyword) domain = 'wash_rejection';
  else if (hasBdHrKeyword) domain = 'bd_labor_hr';
  else if (hasGarmentKeyword) domain = 'garment_consumption';
  else if (has5YrMemoryKeyword) domain = 'five_year_memory';
  else if (/shift|belly|yilmak/i.test(normalizedQuery)) domain = 'shift_production';
  else if (/buyer|rollup|consolidated/i.test(normalizedQuery)) domain = 'buyer_summary';
  else if (/\d+-\d+|style|file|sew|wip|order/i.test(normalizedQuery)) domain = 'erp_order';

  const keywords = normalizedQuery
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  return {
    normalizedQuery,
    domain,
    keywords,
    numbers: {
      kg,
      pcs,
      gsm,
      basicSalary,
      grossSalary,
      otHours,
      workers,
      sam,
      efficiencyPct,
      liquorRatio,
      years,
      lengthCm,
      chestCm,
      wastagePct,
      targetYear,
      rawNumbers
    }
  };
}

/**
 * 1. Inbuilt Industrial Wash Chemical Recipe & Costing Calculation
 */
export function calculateIndustrialWashChemical(
  rawQuery: string,
  intent: CapturedIntent,
  todayDate: string
): { summaryMarkdown: string; sheet: GeneratedExcelSheet } {
  const dryKg =
    intent.numbers.kg ||
    (intent.numbers.pcs ? Number((intent.numbers.pcs * 0.45).toFixed(1)) : 100);
  const estimatedPcs = intent.numbers.pcs || Math.round(dryKg / 0.45);

  const matchedRecipes = WASH_RECIPES.filter(r => r.aliases.test(rawQuery));
  const askAllRecipes = /\b(all|list|every|formula|formulas|chart|guide|types)\b/i.test(intent.normalizedQuery) && matchedRecipes.length === 0;

  // If asking for master overview of ALL industrial wash formulas
  if (askAllRecipes || matchedRecipes.length > 1) {
    const columns = [
      'Wash Type',
      'Standard L:R',
      'Water (L/Kg)',
      'pH Target',
      'Key Chemicals & Dosage',
      'Est. Chemical Cost/Kg (BDT)',
      'Est. Cost/Pc (BDT)'
    ];
    const rows: (string | number)[][] = [];
    let totalCostKgAll = 0;

    for (const rec of matchedRecipes.length > 1 ? matchedRecipes : WASH_RECIPES) {
      const lr = intent.numbers.liquorRatio || rec.defaultLiquorRatio;
      const waterL = 1 * lr;
      let costForOneKg = 0;
      const chemSummary = rec.items
        .map(it => {
          const usedKg =
            it.dosageType === 'g/L'
              ? (waterL * it.dosageValue) / 1000
              : 1 * (it.dosageValue / 100);
          costForOneKg += usedKg * it.unitPriceBdtPerKg;
          return `${it.chemical.split('(')[0].trim()} (${it.dosageValue} ${it.dosageType})`;
        })
        .slice(0, 3)
        .join(' + ');

      const costPerPc = Number((costForOneKg * 0.45).toFixed(2));
      totalCostKgAll += costForOneKg;
      rows.push([
        rec.name,
        `1:${lr}`,
        rec.waterLitersPerKg,
        rec.phRange,
        chemSummary,
        Number(costForOneKg.toFixed(2)),
        costPerPc
      ]);
    }

    const avgCostKg = Number((totalCostKgAll / rows.length).toFixed(2));
    const sheet: GeneratedExcelSheet = {
      sheetName: 'Wash_Chem_Formulas',
      fileName: `Industrial_Wash_Chemical_Formulas_${todayDate}.xlsx`,
      columns,
      rows,
      summaryRow: ['MASTER AVERAGE', '1:6 – 1:10', 'Avg 40 L/Kg', '4.5–11.2', `${rows.length} Processes`, avgCostKg, Number((avgCostKg * 0.45).toFixed(2))],
      formulaSummary: [
        'Volume Chem (Kg) = (Garment Dry Kg × Liquor Ratio × g/L) / 1000',
        'Weight Chem (Kg) = Garment Dry Kg × (% o.w.g. / 100)',
        'Water Volume (L) = Garment Dry Kg × L:R × Baths',
        'Chem Cost/Pc = Total Recipe Cost / Batch Pcs'
      ]
    };

    const bulletList = rows
      .map(r => `• **${r[0]}** (${r[1]}): ${r[4]} — ~**${r[5]} BDT/Kg** (~${r[6]} BDT/pc)`)
      .join('\n');

    return {
      summaryMarkdown: `🧪 **All Industrial Wash Chemical Formulas (Standard Batch Engine):**\n• **g/L Formula:** \`(Dry Weight Kg × L:R × g/L) / 1000 = Chem Kg\`\n• **% o.w.g. Formula:** \`Dry Weight Kg × (% / 100) = Chem Kg\`\n\n${bulletList}\n\n📥 Download full Industrial Chemical Formula sheet (.xlsx) below.`,
      sheet
    };
  }

  // Specific single wash process calculation (default to Enzyme Wash if unspecified)
  const recipe = matchedRecipes[0] || WASH_RECIPES[1];
  const lr = intent.numbers.liquorRatio || recipe.defaultLiquorRatio;
  const liquorLiters = dryKg * lr;

  const columns = [
    'Chemical / Auxiliary',
    'Stage',
    'Temp / Time',
    'Dosage Basis',
    'Rate (g/L or %)',
    'Req. Qty (Kg)',
    'Unit Price (BDT/Kg)',
    'Total Cost (BDT)'
  ];

  let totalChemKg = 0;
  let totalChemCost = 0;

  const rows: (string | number)[][] = recipe.items.map(item => {
    const qtyKg =
      item.dosageType === 'g/L'
        ? (liquorLiters * item.dosageValue) / 1000
        : dryKg * (item.dosageValue / 100);
    const roundedQty = Number(qtyKg.toFixed(3));
    const lineCost = Number((qtyKg * item.unitPriceBdtPerKg).toFixed(2));
    totalChemKg += roundedQty;
    totalChemCost += lineCost;

    return [
      item.chemical,
      item.stage,
      `${item.tempC} / ${item.timeMin}`,
      item.dosageType,
      item.dosageValue,
      roundedQty,
      item.unitPriceBdtPerKg,
      lineCost
    ];
  });

  const waterTotalL = Math.round(dryKg * recipe.waterLitersPerKg);
  const costPerKg = Number((totalChemCost / dryKg).toFixed(2));
  const costPerPc = Number((totalChemCost / Math.max(1, estimatedPcs)).toFixed(2));

  const sheet: GeneratedExcelSheet = {
    sheetName: 'Wash_Chem_Recipe_Calc',
    fileName: `${recipe.key.toUpperCase()}_${dryKg}Kg_Recipe_${todayDate}.xlsx`,
    columns,
    rows,
    summaryRow: [
      'TOTAL RECIPE (=SUM)',
      `${dryKg} Kg (~${estimatedPcs} pcs)`,
      `L:R 1:${lr} (${liquorLiters}L/bath)`,
      recipe.phRange,
      `Water: ${waterTotalL} L`,
      Number(totalChemKg.toFixed(3)),
      `${costPerKg} BDT/Kg`,
      Number(totalChemCost.toFixed(2))
    ],
    formulaSummary: [
      `Batch: ${dryKg} Kg (~${estimatedPcs} pcs) @ Liquor Ratio 1:${lr} (${liquorLiters} L/bath)`,
      `Total Chemical Qty = ${Number(totalChemKg.toFixed(3))} Kg`,
      `Total Chemical Cost = ${Number(totalChemCost.toFixed(2))} BDT (${costPerKg} BDT/Kg | ${costPerPc} BDT/pc)`,
      `Total Water Consumption ≈ ${waterTotalL} L (${recipe.waterLitersPerKg} L/Kg)`
    ]
  };

  const lines = rows
    .map(r => `• **${r[0]}** (${r[1]} • ${r[4]} ${r[3]}): **${r[5]} Kg** = **${r[7]} BDT**`)
    .join('\n');

  return {
    summaryMarkdown: `🧪 **${recipe.name} — Chemical & Cost Calculation**\n• Batch Weight: **${dryKg} Kg** (~${estimatedPcs} pcs) | Liquor Ratio: **1:${lr}** (${liquorLiters} L/bath) | pH: ${recipe.phRange}\n\n${lines}\n\n📊 **Summary Totals:**\n• Total Chemical Weight: **${Number(totalChemKg.toFixed(3))} Kg**\n• Total Chemical Cost: **${Number(totalChemCost.toFixed(2))} BDT** (**${costPerKg} BDT/Kg** • **${costPerPc} BDT/pc**)\n• Process Water + ETP Volume: **${waterTotalL.toLocaleString()} L**\n• *Note: ${recipe.processNotes}*`,
    sheet
  };
}

/**
 * 2. Inbuilt All-Over Garments Consumption, FOB Costing & Efficiency Calculator
 */
export function calculateGarmentConsumptionAndCosting(
  rawQuery: string,
  intent: CapturedIntent,
  todayDate: string
): { summaryMarkdown: string; sheet: GeneratedExcelSheet } {
  const gsm = intent.numbers.gsm || 180;
  const lengthCm = intent.numbers.lengthCm || 74; // Standard L-size T-shirt/Top length+allowance
  const chestCm = intent.numbers.chestCm || 56;   // Standard half-chest + allowance
  const wastagePct = intent.numbers.wastagePct ?? 8;
  const pcs = intent.numbers.pcs || 1000;
  const workers = intent.numbers.workers || 35;
  const sam = intent.numbers.sam || 14;
  const effPct = intent.numbers.efficiencyPct || 65;

  // Knit Consumption (Body + Sleeves factor ~1.32) in Kg per Dozen
  const bodyKgDz = (((lengthCm * chestCm * 2 * gsm) / 10_000_000) * 12) * 1.32;
  const knitKgDzWithWastage = Number((bodyKgDz * (1 + wastagePct / 100)).toFixed(3));
  const knitKgPerPc = Number((knitKgDzWithWastage / 12).toFixed(3));
  const totalFabricKg = Number((knitKgPerPc * pcs).toFixed(2));

  // Woven Denim/Chino Pant Formula (Outseam 108cm + Thigh 34cm @ 58" cuttable width)
  const wovenYdsDz = Number(((((108 * 34 * 4) / (147 * 91.44)) * 12) * (1 + wastagePct / 100)).toFixed(2));
  const wovenYdsPerPc = Number((wovenYdsDz / 12).toFixed(3));

  // All-Over Print / All-Over Garment (AOP / Heavy Fleece) extra +10% dye/print shrinkage
  const aopKgDz = Number((knitKgDzWithWastage * 1.1).toFixed(3));

  // Sewing/Production Line Target & Efficiency
  const workingMinutes = 480; // 8 hrs/day BD shift
  const lineOutputDay = Math.round((workers * workingMinutes * (effPct / 100)) / sam);

  // Standard Garment Costing Benchmark per Dozen / Piece (BD RMG in USD & BDT @ 120 BDT/USD)
  const fxRate = 120;
  const fabricPriceUsdPerKg = 5.4;
  const fabricCostPcUsd = Number((knitKgPerPc * fabricPriceUsdPerKg).toFixed(2));
  const trimCostPcUsd = 0.45;
  const washCostPcUsd = 0.55;
  const cmCostPcUsd = Number(((workers * 560) / Math.max(1, lineOutputDay) / fxRate).toFixed(2)); // ~560 BDT/worker/day avg loaded
  const overheadProfitUsd = Number(((fabricCostPcUsd + trimCostPcUsd + washCostPcUsd + cmCostPcUsd) * 0.12).toFixed(2));
  const fobPcUsd = Number((fabricCostPcUsd + trimCostPcUsd + washCostPcUsd + cmCostPcUsd + overheadProfitUsd).toFixed(2));

  const columns = ['Cost / Consumption Item', 'Formula Used', 'Per Piece', 'Per Dozen (12 pcs)', `For ${pcs.toLocaleString()} Pcs`];
  const rows: (string | number)[][] = [
    ['Knit Fabric (T-Shirt/Polo)', `((L ${lengthCm}×C ${chestCm}×2×${gsm} GSM)/10^7)×12×(1+${wastagePct}%)`, `${knitKgPerPc} Kg`, `${knitKgDzWithWastage} Kg/Dz`, `${totalFabricKg} Kg`],
    ['All-Over Print / Heavy Fleece (+10%)', 'Knit Kg/Dz × 1.10 (AOP shrinkage)', `${Number((aopKgDz / 12).toFixed(3))} Kg`, `${aopKgDz} Kg/Dz`, `${Number(((aopKgDz / 12) * pcs).toFixed(2))} Kg`],
    ['Woven Denim/Twill (58" Width)', '((Outseam×Thigh×4)/(Width×91.44))×12 + Wastage', `${wovenYdsPerPc} Yds`, `${wovenYdsDz} Yds/Dz`, `${Number((wovenYdsPerPc * pcs).toFixed(1))} Yds`],
    ['Line Target Output / Shift', `(Workers ${workers} × 480m × ${effPct}%) / SAM ${sam}`, `${lineOutputDay} pcs/day`, `${Number((lineOutputDay / 12).toFixed(1))} Dz/day`, `${Number((pcs / Math.max(1, lineOutputDay)).toFixed(1))} Days`],
    ['Fabric Cost (@ $5.40/Kg)', 'Kg/Pc × $5.40', `$${fabricCostPcUsd}`, `$${Number((fabricCostPcUsd * 12).toFixed(2))}`, `$${Number((fabricCostPcUsd * pcs).toFixed(2))}`],
    ['Trim + Accessories Cost', 'Buttons, Zipper, Thread, Label', `$${trimCostPcUsd}`, `$${Number((trimCostPcUsd * 12).toFixed(2))}`, `$${Number((trimCostPcUsd * pcs).toFixed(2))}`],
    ['Industrial Wash / AOP Cost', 'Enzyme/Acid Wash + Utility Avg', `$${washCostPcUsd}`, `$${Number((washCostPcUsd * 12).toFixed(2))}`, `$${Number((washCostPcUsd * pcs).toFixed(2))}`],
    ['CM (Cost of Making / Labor)', '(Manpower Cost / Output) ÷ 120', `$${cmCostPcUsd}`, `$${Number((cmCostPcUsd * 12).toFixed(2))}`, `$${Number((cmCostPcUsd * pcs).toFixed(2))}`],
    ['Overhead + Commercial + Margin (12%)', 'Subtotal × 12%', `$${overheadProfitUsd}`, `$${Number((overheadProfitUsd * 12).toFixed(2))}`, `$${Number((overheadProfitUsd * pcs).toFixed(2))}`]
  ];

  const sheet: GeneratedExcelSheet = {
    sheetName: 'Garment_Consumption_FOB',
    fileName: `Garment_Consumption_Costing_${gsm}GSM_${todayDate}.xlsx`,
    columns,
    rows,
    summaryRow: ['TOTAL FOB PRICE', `${pcs.toLocaleString()} pcs @ ${gsm} GSM`, `$${fobPcUsd}/pc (${Math.round(fobPcUsd * fxRate)} BDT)`, `$${Number((fobPcUsd * 12).toFixed(2))}/Dz`, `$${Number((fobPcUsd * pcs).toFixed(2))}`],
    formulaSummary: [
      `Knit Consumption (${gsm} GSM, +${wastagePct}% wastage): ${knitKgDzWithWastage} Kg/Dz (${knitKgPerPc} Kg/pc)`,
      `Woven Denim (58" width): ${wovenYdsDz} Yds/Dz (${wovenYdsPerPc} Yds/pc)`,
      `Line Output (${workers} workers, ${sam} SAM, ${effPct}% eff): ${lineOutputDay} pcs/8hr shift`,
      `Estimated Garment FOB: $${fobPcUsd}/pc ($${Number((fobPcUsd * 12).toFixed(2))}/Dz | ${Math.round(fobPcUsd * fxRate)} BDT/pc)`
    ]
  };

  return {
    summaryMarkdown: `👕 **Garment Consumption, Efficiency & FOB Costing Formula (${gsm} GSM, ${pcs.toLocaleString()} Pcs):**\n• **Knit Consumption Formula:** \`(((Length×Chest×2×GSM)/10,000,000)×12)×(1+Wastage%)\` = **${knitKgDzWithWastage} Kg/Dz** (**${totalFabricKg} Kg** total for ${pcs.toLocaleString()} pcs)\n• **AOP / Heavy Fleece (+10%):** **${aopKgDz} Kg/Dz**\n• **Woven Denim/Twill (58" width):** **${wovenYdsDz} Yds/Dz** (${wovenYdsPerPc} Yds/pc)\n• **Sewing/Wash Efficiency Formula:** \`(Output × SAM) / (Manpower × 480 mins) × 100\` -> At ${effPct}% (${workers} workers, SAM ${sam}) = **${lineOutputDay} pcs/day**\n• **FOB Breakdown:** Fabric **$${fabricCostPcUsd}** + Trims **$${trimCostPcUsd}** + Wash **$${washCostPcUsd}** + CM **$${cmCostPcUsd}** + Margin **$${overheadProfitUsd}** = **$${fobPcUsd}/pc** (**${Math.round(fobPcUsd * fxRate)} BDT/pc**)`,
    sheet
  };
}

/**
 * 3. Inbuilt Bangladesh (BD) Worker Labor Law, Payroll, OT & HR Compliance Calculator
 * Per Bangladesh Labour Act 2006 (Amended 2018) & BD RMG Minimum Wage Gazette (12,500 BDT Entry).
 */
export function calculateBdLaborAndHr(
  rawQuery: string,
  intent: CapturedIntent,
  todayDate: string
): { summaryMarkdown: string; sheet: GeneratedExcelSheet } {
  const otHours = intent.numbers.otHours ?? 2;
  const workersCount = intent.numbers.workers ?? 1;
  const serviceYears = intent.numbers.years ?? 5;
  const pcs = intent.numbers.pcs || 1000;

  // Determine Basic vs Gross per BD RMG Minimum Wage Structure
  // BD RMG Grade 4 Entry Minimum = 12,500 BDT (Basic 6,700 + House 50% (3,350) + Med 750 + Conv 450 + Food 1,250)
  const fixedAllowances = 750 + 450 + 1250; // 2,450 BDT
  let basicSalary = intent.numbers.basicSalary;
  let grossSalary = intent.numbers.grossSalary;

  if (!basicSalary && !grossSalary) {
    // Check if query gave a plain number > 3000 without 'pcs'/'kg'
    const salaryCandidate = intent.numbers.rawNumbers.find(n => n >= 3000 && n !== pcs);
    if (salaryCandidate) {
      if (/\bbasic\b/i.test(rawQuery)) basicSalary = salaryCandidate;
      else grossSalary = salaryCandidate;
    }
  }

  if (basicSalary && !grossSalary) {
    grossSalary = Math.round(basicSalary * 1.5 + fixedAllowances);
  } else if (grossSalary && !basicSalary) {
    // Invert Gross = Basic * 1.5 + 2450
    basicSalary = Math.max(4000, Math.round((grossSalary - fixedAllowances) / 1.5));
  } else if (!basicSalary && !grossSalary) {
    basicSalary = 6700;
    grossSalary = 12500;
  }

  const houseRent = Math.round(basicSalary! * 0.5);
  const medical = 750;
  const conveyance = 450;
  const food = 1250;
  const computedGross = basicSalary! + houseRent + medical + conveyance + food;

  // BD Labor Act Sec 108 Overtime Formula: (Basic / 208) * 2
  const rawOtRate = (basicSalary! / 208) * 2;
  const otHourlyRate = Number(rawOtRate.toFixed(2));
  const dailyBasic = Number((basicSalary! / 30).toFixed(2));
  const dailyGross = Number((computedGross / 30).toFixed(2));
  const workingDayGross = Number((computedGross / 26).toFixed(2));
  const otPayForHours = Number((rawOtRate * otHours).toFixed(2));
  const dailyWorkerTotalWithOt = Number((workingDayGross + otPayForHours).toFixed(2));

  // Total Team Labor Cost
  const totalTeamDailyCost = Number((dailyWorkerTotalWithOt * workersCount).toFixed(2));
  const laborCostPerGarment = Number((totalTeamDailyCost / Math.max(1, pcs)).toFixed(2));

  // Gratuity / Service Benefit (Sec 27): 5-10 yrs = 14 days basic/yr; 10+ yrs = 30 days basic/yr
  const gratuityDaysPerYear = serviceYears >= 10 ? 30 : serviceYears >= 5 ? 14 : 0;
  const gratuityAmount = Math.round((basicSalary! / 30) * gratuityDaysPerYear * serviceYears);

  // Earned Leave Encashment (1 day per 18 working days ≈ 17 days/year @ Gross/30)
  const annualEarnedLeaveDays = 17;
  const elEncashmentValue = Math.round(dailyGross * annualEarnedLeaveDays);

  // 2 Eid Bonuses / Year (100% Basic each)
  const annualEidBonus = basicSalary! * 2;

  const columns = ['BD HR / Labor Law Item', 'BD Act Reference / Formula', 'Single Worker (BDT)', `${workersCount} Worker(s) Total (BDT)`];
  const rows: (string | number)[][] = [
    ['Basic Salary', 'Base Pay (Grade Entry = 6,700)', basicSalary!, basicSalary! * workersCount],
    ['House Rent (50% Basic)', 'Basic × 50%', houseRent, houseRent * workersCount],
    ['Medical + Conveyance + Food', '750 + 450 + 1,250 Fixed Gazette', fixedAllowances, fixedAllowances * workersCount],
    ['Monthly Gross Salary', 'Basic + House + Med + Conv + Food', computedGross, computedGross * workersCount],
    ['OT Hourly Rate (Double Basic)', 'Sec 108: (Basic ÷ 208) × 2', `${otHourlyRate} BDT/hr`, `${Number((otHourlyRate * workersCount).toFixed(2))} BDT/hr`],
    [`Overtime Pay (${otHours} hrs)`, `OT Rate × ${otHours} hrs (Max 2h/day reg.)`, otPayForHours, Number((otPayForHours * workersCount).toFixed(2))],
    ['Per Working Day Wage (26d basis)', 'Gross ÷ 26', workingDayGross, Number((workingDayGross * workersCount).toFixed(2))],
    ['2 Eid / Festival Bonuses (Yearly)', 'Rule 111(5): 2 × 100% Basic', annualEidBonus, annualEidBonus * workersCount],
    ['Earned Leave (18d:1d) Encashment', 'Sec 117: ~17 days × (Gross ÷ 30)', elEncashmentValue, elEncashmentValue * workersCount],
    [`Service Benefit (${serviceYears} yrs)`, `Sec 27: ${gratuityDaysPerYear}d Basic/yr`, gratuityAmount, gratuityAmount * workersCount],
    ['Maternity / CL / SL / Festival Leave', 'Sec 46, 115, 116, 118 (Statutory)', '112d Mat | 10d CL | 14d SL | 11d Fest', '100% Paid Statutory']
  ];

  const sheet: GeneratedExcelSheet = {
    sheetName: 'BD_Labor_Law_HR_Calc',
    fileName: `BD_Labor_Law_Payroll_HR_${todayDate}.xlsx`,
    columns,
    rows,
    summaryRow: [
      'DAILY LABOR COST + OT',
      `Batch Cost / ${pcs} pcs = ${laborCostPerGarment} BDT/pc`,
      dailyWorkerTotalWithOt,
      totalTeamDailyCost
    ],
    formulaSummary: [
      `Monthly Gross = ${computedGross.toLocaleString()} BDT (Basic ${basicSalary!.toLocaleString()} + 50% House ${houseRent.toLocaleString()} + 2,450 Allow.)`,
      `Sec 108 OT Rate = (${basicSalary} ÷ 208) × 2 = ${otHourlyRate} BDT/hr (${otHours} hrs = ${otPayForHours} BDT)`,
      `Daily Labor Cost (${workersCount} worker + ${otHours}h OT) = ${totalTeamDailyCost.toLocaleString()} BDT/day (${laborCostPerGarment} BDT/pc for ${pcs} pcs)`,
      `BD Statutory Leaves: 10d Casual + 14d Sick + 1:18 Earned + 11d Festival (2x+Comp if worked) + 112d Maternity`
    ]
  };

  return {
    summaryMarkdown: `🇧🇩 **Bangladesh (BD) Worker Labor Law & HR Costing Calculation:**\n• **Monthly Wage Breakdown:** Basic **${basicSalary!.toLocaleString()} BDT** + House Rent (50%) **${houseRent.toLocaleString()} BDT** + Medical **750** + Conveyance **450** + Food **1,250** = **${computedGross.toLocaleString()} BDT/month**\n• **Sec 108 Overtime Formula:** \`(Basic ÷ 208) × 2\` = **${otHourlyRate} BDT/hr** -> For **${otHours} hrs OT** = **${otPayForHours.toLocaleString()} BDT**\n• **Daily Labor Cost (${workersCount} worker(s) + ${otHours}h OT):** **${totalTeamDailyCost.toLocaleString()} BDT/day** (Daily Basic avg ${dailyBasic} BDT • Per-Pc Labor Cost across ${pcs.toLocaleString()} pcs = **${laborCostPerGarment} BDT/pc**)\n• **Mandatory BD HR Compliance Rules:**\n  - **Shift Hours (Sec 100/102):** 8 hrs/day, 48 hrs/week regular; max 2 hrs OT/day (60 hrs/week limit).\n  - **Paid Leave (Sec 115-118):** Casual **10 days/yr**, Sick **14 days/yr**, Earned **1 day per 18 work days** (~${elEncashmentValue.toLocaleString()} BDT/yr cash value), Festival Holidays **11 days/yr** (2x pay + comp holiday if worked), Maternity **112 days (16 weeks)**.\n  - **Bonuses & Benefits:** **2 Eid Bonuses/yr** (= **${annualEidBonus.toLocaleString()} BDT**), **WPPF 5% Net Profit** (Sec 234), **PF 7-8%** optional, **Service Benefit** (${serviceYears} yrs = **${gratuityAmount.toLocaleString()} BDT**).`,
    sheet
  };
}

export const INDUSTRIAL_SUPPORT_KNOWLEDGE: SupportKnowledgeRule[] = [
  {
    id: 'skill-chem-formulas',
    trigger: 'chemical, enzyme, acid wash, bleach, desize, stone, dye, softener, lr, recipe',
    ruleText: 'Industrial Wash Chemical Formulas: Volume-based Kg = (DryKg × LiquorRatio × g/L) / 1000; Weight-based Kg = DryKg × (% o.w.g. / 100). Covers Desize, Enzyme, Stone, Acid/KMnO4, Bleach, Dyeing, Resin 3D.',
    category: 'chemical',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  {
    id: 'skill-garment-consumption',
    trigger: 'consumption, gsm, knit, woven, denim, fob, cm, efficiency, sam, aop',
    ruleText: 'Garment Formulas: Knit Kg/Dz = (((L×C×2×GSM)/10^7)×12)×(1+Wastage%); Line Eff % = (Output×SAM)/(Manpower×Mins)×100; FOB = Fabric + Trim + Wash + CM + Margin.',
    category: 'garment',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  {
    id: 'skill-bd-labor-law',
    trigger: 'bd, bangladesh, labor, worker, ot, overtime, salary, wage, leave, gratuity, maternity, bonus',
    ruleText: 'BD Labor Act 2006/2018 & RMG Min Wage: OT Rate = (Basic ÷ 208) × 2; Gross = Basic + 50% House + 750 Med + 450 Conv + 1,250 Food; Leaves = 10d CL + 14d SL + 1:18 EL + 11d Fest + 112d Mat; 2 Eid Bonuses (100% Basic each).',
    category: 'bd_hr',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  {
    id: 'skill-5yr-memory-100mb',
    trigger: '5 year, history, past, archive, memory, cache, 100mb, yearly',
    ruleText: 'Inbuilt 5-Year Historical Recall & Browser IndexedDB Cache (up to 100 MB) searches active orders, buyer_data_bank archives, 5-year daily logs, 3-shift reports, and prior Support conversation memory.',
    category: 'memory',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  },
  {
    id: 'skill-wash-rejection',
    trigger: 'reject, rejection, before wash, after wash, shade, body hole, needle cut, zipper, percentage upto',
    ruleText: 'Multi-Buyer Wash Rejection Formula: Tracks Before Wash & After Wash rejections by Size (XS-XXL, No Size) across ALL buyers. Rejection % = (Group Rejection TTL / ERP Recv Qty) * 100.',
    category: 'formula',
    confidenceScore: 100,
    usageCount: 0,
    createdBy: 'system',
    createdAt: '2026-11-18T00:00:00.000Z'
  }
];
