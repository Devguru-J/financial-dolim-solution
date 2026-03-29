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

    const hasHighResidual = cbPGrade != null || tyPGrade != null || jyPGrade != null || crPGrade != null || adbPGrade != null;

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
// RVs parser — builds matrixGroup → term → rate lookup
//
// Provider tables (0-indexed row offsets):
//   WS통합:  header row 2,  data rows 3-9   (terms: 12/24/36/42/44/48/60)
//   WS수입:  header row 15, data rows 16-22
//   CB:      header row 28, data rows 29-35
//   MK:      header row 39, data rows 40-46
//   TY:      header row 51, data rows 52-58
//   JY:      header row 64, data rows 65-71 (terms: 12/24/36/42/44/48/60)
//   CR:      header row 76, data rows 77-81 (terms: 12/24/36/48/60)
//   ADB:     header row 86, data rows 87-91 (terms: 12/24/36/48/60)
//
// Grade lookup: grade index N from CDB maps to col N in the provider's rate table.
// For letter-grade tables (CB A-Q cols 1-17, CR A-Z cols 1-26, ADB A-I cols 1-9,
// JY S/A/B/C/D/E/F cols 1-7 + PS/PA/PB/PC cols 8-11, WS S/A/B/C/D/E/F/G/H/I cols 1-10):
// matrixGroup = "{PROVIDER}_{gradeIndex}"
// ---------------------------------------------------------------------------

type ProviderTableSpec = {
  prefix: string;
  headerRow: number;
  dataRows: [number, number]; // [start, end] inclusive
  gradeColStart: number;
  gradeColEnd: number;
};

const PROVIDER_TABLES: ProviderTableSpec[] = [
  { prefix: "WS통합", headerRow: 2, dataRows: [3, 9], gradeColStart: 1, gradeColEnd: 10 },
  { prefix: "WS수입", headerRow: 15, dataRows: [16, 22], gradeColStart: 1, gradeColEnd: 10 },
  { prefix: "CB", headerRow: 28, dataRows: [29, 35], gradeColStart: 1, gradeColEnd: 17 },
  { prefix: "TY", headerRow: 51, dataRows: [52, 58], gradeColStart: 1, gradeColEnd: 15 },
  { prefix: "JY", headerRow: 64, dataRows: [65, 71], gradeColStart: 1, gradeColEnd: 11 },
  { prefix: "CR", headerRow: 76, dataRows: [77, 81], gradeColStart: 1, gradeColEnd: 26 },
  { prefix: "ADB", headerRow: 86, dataRows: [87, 91], gradeColStart: 1, gradeColEnd: 9 },
];

function parseResidualMatrixRows(rows: unknown[][]): WorkbookResidualMatrixRow[] {
  const results: WorkbookResidualMatrixRow[] = [];

  for (const spec of PROVIDER_TABLES) {
    const headerRow = rows[spec.headerRow];
    if (!headerRow) continue;

    // Build grade label map: col index → grade label
    const gradeLabelByCol = new Map<number, string>();
    for (let col = spec.gradeColStart; col <= spec.gradeColEnd; col++) {
      const label = asText(headerRow[col]);
      if (label) gradeLabelByCol.set(col, label);
    }

    // Parse each data row (each row = one term)
    for (let rowIdx = spec.dataRows[0]; rowIdx <= spec.dataRows[1]; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;

      const term = asNumber(row[0]);
      if (term == null) continue;

      // Only standard lease terms
      if (![12, 24, 36, 48, 60].includes(term)) continue;

      for (let col = spec.gradeColStart; col <= spec.gradeColEnd; col++) {
        const rate = asNumber(row[col]);
        if (rate == null || rate <= 0) continue;

        const gradeLabel = gradeLabelByCol.get(col) ?? String(col);
        const matrixGroup = `${spec.prefix}_${col}`;

        results.push({
          matrixGroup,
          gradeCode: gradeLabel,
          leaseTermMonths: term,
          residualRate: rate,
        });
      }
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
