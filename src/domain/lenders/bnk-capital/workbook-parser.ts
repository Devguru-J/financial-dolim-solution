import * as XLSX from "xlsx";

import type {
  WorkbookBrandRatePolicy,
  WorkbookPreview,
  WorkbookResidualMatrixRow,
  WorkbookVehicleProgram,
} from "@/domain/imports/types";
import type { ParseWorkbookOptions } from "@/domain/imports/lender-adapter";

const REQUIRED_SHEETS = ["CDB", "RVs", "Cond"] as const;

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  }) as unknown[][];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replaceAll(",", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t || null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
}

// ---------------------------------------------------------------------------
// CDB parser — rows 3+ (row 2 = header, row 0/1 = meta)
// Col layout (0-indexed, confirmed from header row 2):
//   [4]=브랜드, [6]=차명(세부), [7]=년식, [12]=차량등급,
//   [13]=배기량, [14]=친환경차, [15]=CB, [17]=TY, [18]=JY,
//   [19]=CR, [20]=CB P, [22]=TY P, [23]=JY P, [24]=CR P,
//   [34]=차종 프로모션, [35]=ADB, [36]=ADB P, [51]=삭제 대상
// Note: vehicle prices (col 33) are null in this workbook — users must provide price manually
// ---------------------------------------------------------------------------
function parseVehiclePrograms(rows: unknown[][]): WorkbookVehicleProgram[] {
  // Deduplicate by (brand, modelName) keeping the highest model year entry.
  // BNK CDB lists the same model across multiple years; only the latest matters for quotes.
  type Entry = { program: WorkbookVehicleProgram; modelYear: number | null };
  const seen = new Map<string, Entry>();

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const brand = asText(row[4]);
    const modelName = asText(row[6]);
    const deleted = asBool(row[51]);

    if (!brand || !modelName || deleted) continue;

    const modelYear = asNumber(row[7]);
    const key = `${brand}|${modelName}`;
    const existing = seen.get(key);

    // Skip if we already have a newer model year entry
    if (existing != null) {
      const existingYear = existing.modelYear ?? 0;
      const thisYear = modelYear ?? 0;
      if (thisYear <= existingYear) continue;
    }

    const vehicleClass = asText(row[12]);
    const cc = asNumber(row[13]);
    const eco = asNumber(row[14]) === 1 || asBool(row[14]);

    const wsGrade = asNumber(row[10]);
    const wsPGrade = asNumber(row[11]);
    const cbGrade = asNumber(row[15]);
    const cbPGrade = asNumber(row[20]);
    const tyGrade = asNumber(row[17]);
    const tyPGrade = asNumber(row[22]);
    const jyGrade = row[18] != null ? String(row[18]) : null;
    const jyPGrade = row[23] != null ? String(row[23]) : null;
    const crGrade = asNumber(row[19]);
    const crPGrade = asNumber(row[24]);
    const adbGrade = asNumber(row[35]);
    const adbPGrade = asNumber(row[36]);
    const promoCode = asText(row[34]);

    const hasHighResidual = wsPGrade != null || cbPGrade != null || tyPGrade != null || jyPGrade != null || crPGrade != null || adbPGrade != null;

    seen.set(key, {
      modelYear,
      program: {
        brand,
        modelName,
        vehiclePrice: 0, // BNK workbook does not store vehicle prices — must be entered manually
        vehicleClass,
        engineDisplacementCc: cc,
        highResidualAllowed: hasHighResidual,
        hybridAllowed: eco,
        residualPromotionCode: promoCode,
        snkResidualBand: null,
        apsResidualBand: null,
        residuals: {},
        snkResiduals: {},
        apsResiduals: {},
        chatbotResiduals: {},
        apsPromotionRate: null,
        snkPromotionRate: null,
        rawRow: {
          wsGrade,
          wsPGrade,
          cbGrade,
          cbPGrade,
          tyGrade,
          tyPGrade,
          jyGrade,
          jyPGrade,
          crGrade,
          crPGrade,
          adbGrade,
          adbPGrade,
          modelYear,
          vehicleClass,
          eco,
        },
      },
    });
  }

  return Array.from(seen.values()).map((e) => e.program);
}

// ---------------------------------------------------------------------------
// RVs parser — unified BNK residual rate table
//
// Es1 calculates residual rates from the unified BNK table at RVs!AG8:CW67,
// NOT from the small per-provider tables (WS통합/CB/TY/JY/CR/ADB rows 1-91).
// The small tables are reference data with different values — using them would
// cause systematic errors in guarantee fee calculation.
//
// Unified table structure (0-indexed):
//   Header row 6 (AG7:CW7): grade labels — S1..S10, 1, 1.5, 2, 2.5, ..., 29
//   Term column 31 (AF8:AF67): months 1-60
//   Data: row 7..66, cols 32..98
//
// CDB grade values (cbGrade, tyGrade, jyGrade, crGrade, adbGrade) map directly
// to column headers in this table.  E.g. cbGrade=9 → column "9", jyGrade="S8" → "S8".
//
// matrixGroup = "BNK_{headerLabel}" — shared across all providers since they
// all reference the same table. Engine resolves per-provider by looking up the
// vehicle's grade for that provider.
// ---------------------------------------------------------------------------

const BNK_UNIFIED_TABLE = {
  headerRow: 4,       // array idx with blankrows:false — grade labels (S1..S10, 1, 1.5, ..., 29)
  termCol: 31,        // 0-indexed col AF (lease term months)
  gradeColStart: 32,  // 0-indexed col AG (first grade column)
  gradeColEnd: 98,    // 0-indexed col CU (scan up to here)
  dataRowStart: 5,    // array idx — first data row (month 1)
  dataRowEnd: 64,     // array idx — last data row (month 60)
} as const;

function parseResidualMatrixRows(rows: unknown[][]): WorkbookResidualMatrixRow[] {
  const results: WorkbookResidualMatrixRow[] = [];

  const headerRow = rows[BNK_UNIFIED_TABLE.headerRow];
  if (!headerRow) return results;

  // Build grade label map: col index → header label
  const gradeLabelByCol = new Map<number, string>();
  for (let col = BNK_UNIFIED_TABLE.gradeColStart; col <= BNK_UNIFIED_TABLE.gradeColEnd; col++) {
    const raw = headerRow[col];
    if (raw == null) continue;
    // Headers can be numbers (1, 1.5, 9) or strings (S1, S8)
    const label = typeof raw === "number" ? String(raw) : asText(raw);
    if (label) gradeLabelByCol.set(col, label);
  }

  // Parse each data row (each row = one month in the 1-60 range)
  for (let rowIdx = BNK_UNIFIED_TABLE.dataRowStart; rowIdx <= BNK_UNIFIED_TABLE.dataRowEnd; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    const term = asNumber(row[BNK_UNIFIED_TABLE.termCol]);
    if (term == null) continue;

    // Only standard lease terms
    if (![12, 24, 36, 48, 60].includes(term)) continue;

    for (const [col, label] of gradeLabelByCol) {
      const rate = asNumber(row[col]);
      if (rate == null || rate <= 0) continue;

      results.push({
        matrixGroup: `BNK_${label}`,
        gradeCode: label,
        leaseTermMonths: term,
        residualRate: rate,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Cond parser — extracts operating-lease IRR rates by condition type,
// and maps each brand to its condition type.
//
// Brand → conditionType mapping: rows 3-54, cols [9]=brand, [11]=conditionType
// IRR by conditionType: rows 66-73, col [11]=conditionType, col [12]=baseIrr (법인),
//   col [13]=secondIrr (if present, may be for individual/high-risk)
//
// Resulting brandRatePolicies: one entry per (brand, ownershipType)
// ---------------------------------------------------------------------------

type ConditionTypeIrr = {
  company: number;
  customer: number;
};

function parseCondBrandPolicies(rows: unknown[][]): WorkbookBrandRatePolicy[] {
  // Step 1: Build conditionType → IRR map from rows 60-80
  const condTypeIrr = new Map<string, ConditionTypeIrr>();
  for (let i = 60; i < Math.min(rows.length, 85); i++) {
    const row = rows[i];
    const condType = asText(row[11]);
    if (!condType) continue;
    const irr1 = asNumber(row[12]);
    const irr2 = asNumber(row[13]);
    if (irr1 == null) continue;
    condTypeIrr.set(condType, {
      company: irr1,
      // If a second value exists, it's the higher/customer rate; otherwise same as company
      customer: irr2 ?? irr1,
    });
  }

  // Step 2: Build brand → conditionType map from rows 3-54
  const brandCondType = new Map<string, string>();
  for (let i = 3; i < Math.min(rows.length, 55); i++) {
    const row = rows[i];
    const brand = asText(row[9]);
    const condType = asText(row[11]);
    if (brand && condType) {
      // Only store the first entry per brand (subsequent rows may be dealer overrides)
      if (!brandCondType.has(brand)) {
        brandCondType.set(brand, condType);
      }
    }
  }

  // Step 3: Also check for EV condition
  // Es1 sheet mentions EV IRR = 0.049; handle this via the eco flag in the engine

  // Step 4: Emit one policy per brand × ownership
  const results: WorkbookBrandRatePolicy[] = [];
  for (const [brand, condType] of brandCondType.entries()) {
    const irr = condTypeIrr.get(condType);
    if (!irr) continue;

    results.push({
      brand,
      productType: "operating_lease",
      ownershipType: "company",
      baseIrrRate: irr.company,
    });
    if (irr.customer !== irr.company) {
      results.push({
        brand,
        productType: "operating_lease",
        ownershipType: "customer",
        baseIrrRate: irr.customer,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Top-level parser
// ---------------------------------------------------------------------------

export function parseBnkWorkbook(input: ArrayBuffer, options: ParseWorkbookOptions): WorkbookPreview {
  const workbook = XLSX.read(input, { type: "array", raw: true });

  const sheetNames = workbook.SheetNames;
  const hasAllSheets = REQUIRED_SHEETS.every((s) => sheetNames.includes(s));

  const cdbRows = sheetToRows(workbook, "CDB");
  const rvsRows = sheetToRows(workbook, "RVs");
  const condRows = sheetToRows(workbook, "Cond");

  const vehiclePrograms = hasAllSheets ? parseVehiclePrograms(cdbRows) : [];
  const residualMatrixRows = hasAllSheets ? parseResidualMatrixRows(rvsRows) : [];
  const brandRatePolicies = hasAllSheets ? parseCondBrandPolicies(condRows) : [];

  // Detect version from Cond cell (row 0, col 7 or 8)
  let detectedVersionLabel = "unknown";
  if (condRows[0]) {
    const v1 = asText(condRows[0][7]);
    const v2 = asText(condRows[0][8]);
    detectedVersionLabel = v2 ?? v1 ?? "unknown";
  }

  return {
    lenderCode: options.lenderCode,
    lenderName: "BNK Capital",
    sourceFileName: options.fileName,
    detectedVersionLabel,
    sheetNames,
    analysis: {
      hasVehicleDb: sheetNames.includes("CDB"),
      hasResidualMap: sheetNames.includes("RVs"),
      hasBrandRatePolicies: sheetNames.includes("Cond"),
      vehicleProgramCount: vehiclePrograms.length,
      residualMatrixRowCount: residualMatrixRows.length,
      brandRatePolicyCount: brandRatePolicies.length,
    },
    vehiclePrograms,
    residualMatrixRows,
    brandRatePolicies,
    sheetContracts: {
      operatingLease: null, // BNK quote sheet (Es1) parsing deferred
    },
  };
}
