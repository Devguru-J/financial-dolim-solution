import * as XLSX from "xlsx";
import type { ParseWorkbookOptions } from "@/domain/imports/lender-adapter";
import type {
  WorkbookBrandRatePolicy,
  WorkbookPreview,
  WorkbookResidualMatrixRow,
  WorkbookVehicleProgram,
} from "@/domain/imports/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][];
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function asNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard lease terms we store in the DB */
const STANDARD_TERMS = [12, 24, 36, 48, 60] as const;

/** RV provider configs */
const RV_PROVIDERS = [
  { name: "SAMIL", sheetName: "잔가_삼일" },
  { name: "YUCA", sheetName: "잔가_유카" },
  { name: "AUTOHANDS", sheetName: "잔가_오토핸즈" },
] as const;

/**
 * RV table layout (shared by all 3 provider sheets):
 * - Row 8 (idx 7): grade letter header A-Z
 * - Row 9 (idx 8): first data row (month 1)
 * - Row 68 (idx 67): last data row (month 60)
 * - Col E (idx 4): month number
 * - Cols F-AE (idx 5-30): grades A-Z (26 columns)
 *
 * High-RV table:
 * - Same row range
 * - Col AI (idx 34): month number
 * - Cols AJ-BI (idx 35-60): grades A-Z
 */
/**
 * RV table layout — indices are RELATIVE to sheet range start (B=0).
 * sheet_to_json with header:1 returns arrays indexed from the range's first column.
 */
const RV_TABLE = {
  headerRowIdx: 5, // grade letter header row (with blankrows:false)
  dataRowStartIdx: 6, // first data row (month 1)
  dataRowEndIdx: 65, // last data row (month 60)
  // Normal table
  normalMonthCol: 3, // E (relative to B=0)
  normalGradeStartCol: 4, // F
  normalGradeEndCol: 29, // AE (26 columns = A through Z)
  // High-RV table
  highMonthCol: 33, // AI
  highGradeStartCol: 34, // AJ
  highGradeEndCol: 59, // BI
};

/**
 * Vehicle catalog columns — relative to B=0 (sheet range starts at B).
 * D=2, E=3, F=4, G=5, H=6, I=7, J=8, K=9, L=10, M=11, N=12, O=13
 */
const VEH = {
  brand: 2, // D
  model: 3, // E
  price: 4, // F
  displacement: 5, // G
  fuel: 6, // H (취득세 연료)
  engine: 7, // I
  vehicleClass: 8, // J
  autohandsGrade: 9, // K
  samilGrade: 10, // L
  yucaGrade: 11, // M
  samilSuperHighGrade: 12, // N
  yucaSuperHighGrade: 13, // O
  samilAdjust: 14, // P (잔가가감 삼일)
  yucaAdjust: 15, // Q (잔가가감 유카)
  residualUpgrade: 24, // Z (잔가상향)
};

// ---------------------------------------------------------------------------
// Vehicle Programs Parser
// ---------------------------------------------------------------------------

function parseVehiclePrograms(workbook: XLSX.WorkBook): WorkbookVehicleProgram[] {
  const rows = sheetToRows(workbook, "차량정보");
  if (rows.length < 7) return [];

  // Find header row ("Brand" at VEH.brand column), data starts next row.
  let dataStart = 6; // default: with blankrows:false, header at idx 5, data at idx 6
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (rows[i]?.[VEH.brand] === "Brand") { dataStart = i + 1; break; }
  }

  const programs: WorkbookVehicleProgram[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const brand = asText(row[VEH.brand]);
    const model = asText(row[VEH.model]);
    if (!brand || !model) continue;

    const displacement = asNumber(row[VEH.displacement]);
    const fuel = asText(row[VEH.fuel]);
    const vehicleClass = asText(row[VEH.vehicleClass]);
    const price = asNumber(row[VEH.price]) ?? 0;

    const samilGrade = asText(row[VEH.samilGrade]);
    const yucaGrade = asText(row[VEH.yucaGrade]);
    const autohandsGrade = asText(row[VEH.autohandsGrade]);
    const samilSuperHighGrade = asText(row[VEH.samilSuperHighGrade]);
    const yucaSuperHighGrade = asText(row[VEH.yucaSuperHighGrade]);

    // Determine fuel type for tax handling
    const fuelType = classifyFuel(fuel);

    programs.push({
      brand,
      modelName: model,
      vehiclePrice: price,
      engineDisplacementCc: displacement,
      vehicleClass,
      highResidualAllowed: !!(samilGrade || yucaGrade), // 고잔가 available if grade exists
      hybridAllowed: fuelType === "HEV" || fuelType === "PHEV",
      residualPromotionCode: null,
      snkResidualBand: null,
      apsResidualBand: null,
      apsPromotionRate: null,
      snkPromotionRate: null,
      residuals: {},
      snkResiduals: {},
      apsResiduals: {},
      chatbotResiduals: {},
      rawRow: {
        // Woori-card specific fields
        samilGrade,
        yucaGrade,
        autohandsGrade,
        samilSuperHighGrade,
        yucaSuperHighGrade,
        samilAdjust: asNumber(row[VEH.samilAdjust]) ?? 0,
        yucaAdjust: asNumber(row[VEH.yucaAdjust]) ?? 0,
        residualUpgrade: asNumber(row[VEH.residualUpgrade]) ?? 0,
        fuel,
        fuelType,
      },
    });
  }

  return programs;
}

function classifyFuel(fuel: string | null): string {
  if (!fuel) return "ICE";
  if (fuel === "전기" || fuel === "전기_비감면") return "EV";
  if (fuel === "수소") return "HYDROGEN";
  if (fuel === "HEV" || fuel.includes("하이브리드")) return "HEV";
  if (fuel === "PHEV") return "PHEV";
  return "ICE";
}

// ---------------------------------------------------------------------------
// Residual Matrix Parser
// ---------------------------------------------------------------------------

function parseResidualMatrixRows(workbook: XLSX.WorkBook): WorkbookResidualMatrixRow[] {
  const result: WorkbookResidualMatrixRow[] = [];

  for (const provider of RV_PROVIDERS) {
    const rows = sheetToRows(workbook, provider.sheetName);
    if (rows.length < RV_TABLE.dataRowEndIdx + 1) continue;

    // Parse normal table
    parseRvTable(rows, provider.name, false, result);

    // Parse high-RV table
    parseRvTable(rows, provider.name, true, result);
  }

  return result;
}

function parseRvTable(
  rows: unknown[][],
  providerName: string,
  isHigh: boolean,
  out: WorkbookResidualMatrixRow[]
): void {
  const headerRow = rows[RV_TABLE.headerRowIdx];
  const monthCol = isHigh ? RV_TABLE.highMonthCol : RV_TABLE.normalMonthCol;
  const gradeStartCol = isHigh ? RV_TABLE.highGradeStartCol : RV_TABLE.normalGradeStartCol;
  const gradeEndCol = isHigh ? RV_TABLE.highGradeEndCol : RV_TABLE.normalGradeEndCol;

  // Read grade letters from header row
  const grades: (string | null)[] = [];
  for (let c = gradeStartCol; c <= gradeEndCol; c++) {
    grades.push(asText(headerRow?.[c]));
  }

  const matrixGroupPrefix = isHigh ? `WOORI_${providerName}_HIGH` : `WOORI_${providerName}`;

  for (let r = RV_TABLE.dataRowStartIdx; r <= RV_TABLE.dataRowEndIdx; r++) {
    const row = rows[r];
    if (!row) continue;

    const month = asNumber(row[monthCol]);
    if (month == null || !STANDARD_TERMS.includes(month as any)) continue;

    for (let gc = 0; gc < grades.length; gc++) {
      const grade = grades[gc];
      if (!grade) continue;

      const rate = asNumber(row[gradeStartCol + gc]);
      if (rate == null || rate <= 0 || rate > 1) continue;

      out.push({
        matrixGroup: `${matrixGroupPrefix}_${grade}`,
        gradeCode: grade,
        leaseTermMonths: month,
        residualRate: rate,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Brand Rate Policies Parser
// ---------------------------------------------------------------------------

function parseBrandRatePolicies(workbook: XLSX.WorkBook): WorkbookBrandRatePolicy[] {
  const policies: WorkbookBrandRatePolicy[] = [];

  // 중요정보 sheet — IRR rates from (지점장) sheet
  // company IRR = (지점장) H4 = 0.045, customer IRR = (지점장) H6 = 0.057
  // These are fixed for all brands. We read them from 중요정보 or (지점장).
  // (지점장) sheet — H column = relative index 6 (B=0)
  const mgrRows = sheetToRows(workbook, "(지점장)");
  let companyIrr = 0.045;
  let customerIrr = 0.057;
  // Find the row with "금융사명의_운용리스"
  for (let i = 0; i < mgrRows.length; i++) {
    const label = asText(mgrRows[i]?.[3]); // E column = idx 3
    if (label?.includes("금융사명의") && label?.includes("운용리스")) {
      companyIrr = asNumber(mgrRows[i]?.[6]) ?? 0.045; // H column = idx 6
    }
    if (label?.includes("이용자명의") && label?.includes("운용리스")) {
      customerIrr = asNumber(mgrRows[i]?.[6]) ?? 0.057;
    }
  }

  // Read brand list from 중요정보 L column = relative index 10 (B=0)
  const infoRows = sheetToRows(workbook, "중요정보");
  const brands: string[] = [];
  // Find the row with "BRAND" label, then read brands below it
  let brandStartIdx = -1;
  for (let i = 0; i < Math.min(infoRows.length, 20); i++) {
    if (asText(infoRows[i]?.[10]) === "BRAND") { brandStartIdx = i + 1; break; }
  }
  if (brandStartIdx >= 0) {
    for (let i = brandStartIdx; i < brandStartIdx + 35; i++) {
      const brand = asText(infoRows[i]?.[10]); // L column = idx 10
      if (brand) brands.push(brand);
      else break; // stop at first empty cell
    }
  }

  // Create policies for each brand
  for (const brand of brands) {
    policies.push({
      brand,
      productType: "operating_lease",
      ownershipType: "company",
      baseIrrRate: companyIrr,
    });
    policies.push({
      brand,
      productType: "operating_lease",
      ownershipType: "customer",
      baseIrrRate: customerIrr,
    });
  }

  // Parse dealer fee table from 중요정보 O11:W31
  // Dealer rows start at idx 11 (row 12)
  const dealerPolicies = parseDealerFees(infoRows);
  policies.push(...dealerPolicies);

  return policies;
}

function parseDealerFees(infoRows: unknown[][]): WorkbookBrandRatePolicy[] {
  const policies: WorkbookBrandRatePolicy[] = [];

  // Find the dealer fee table: row with "구분" at O column (idx 13, relative to B=0)
  let dealerStartIdx = -1;
  for (let i = 0; i < infoRows.length; i++) {
    if (asText(infoRows[i]?.[13]) === "구분" && asText(infoRows[i]?.[14]) === "제휴수수료") {
      dealerStartIdx = i + 1;
      break;
    }
  }
  if (dealerStartIdx < 0) return policies;

  // O = 13 (dealerName), P = 14 (제휴수수료), Q = 15 (SM수수료), R = 16 (전담AG수수료)
  for (let i = dealerStartIdx; i < dealerStartIdx + 25; i++) {
    const row = infoRows[i];
    if (!row) continue;

    const dealerName = asText(row[13]); // O column = idx 13
    if (!dealerName) break;

    const affiliateFeeRate = asNumber(row[14]) ?? 0; // P: 제휴수수료
    const smFeeRate = asNumber(row[15]) ?? 0; // Q: SM수수료
    const dedicatedAgFeeRate = asNumber(row[16]) ?? 0; // R: 전담AG수수료

    policies.push({
      brand: dealerName,
      productType: "operating_lease",
      ownershipType: "company",
      baseIrrRate: affiliateFeeRate + smFeeRate + dedicatedAgFeeRate,
      dealerName,
    });
  }

  return policies;
}

// ---------------------------------------------------------------------------
// RV Guarantee Fee Tables Parser
// ---------------------------------------------------------------------------

export type WooriRvGuaranteeFees = {
  samilHighFee: number; // 정액 (VAT 포함), e.g. 528,000
  samilSuperHighBaseFee: number; // 정액 부분
  samilSuperHighVehicleRate: number; // 차량가 비율 부분
  yucaHighRate: number; // 차량가 비율, e.g. 0.0077
  yucaSuperHighRate: number; // 차량가 비율
  autohandsHighRate: number; // 차량가 비율, e.g. 0.0198
  autohandsSuperHighRate: number; // 차량가 비율
  samilHighBrands: string[]; // 삼일 고잔가 적용 브랜드 리스트
};

function parseRvGuaranteeFees(infoRows: unknown[][]): WooriRvGuaranteeFees {
  // Find "잔가보장수수료" label (D column = idx 2 relative to B=0)
  // Then read fee values below: F=4, H=6
  let feeStartIdx = -1;
  for (let i = 0; i < infoRows.length; i++) {
    if (asText(infoRows[i]?.[2]) === "잔가보장수수료") { feeStartIdx = i; break; }
  }

  if (feeStartIdx < 0) {
    return {
      autohandsHighRate: 0.0198, autohandsSuperHighRate: 0,
      yucaHighRate: 0.0077, yucaSuperHighRate: 0,
      samilHighFee: 528000, samilSuperHighBaseFee: 528000, samilSuperHighVehicleRate: 0.011,
      samilHighBrands: parseSamilHighBrands(infoRows),
    };
  }

  // Row feeStartIdx+1 = 오토핸즈, +2 = 유카, +3 = 삼일(vat포함), +4 = +차량가기준
  return {
    autohandsHighRate: asNumber(infoRows[feeStartIdx + 1]?.[4]) ?? 0.0198, // F: 고잔가 rate
    autohandsSuperHighRate: asNumber(infoRows[feeStartIdx + 1]?.[6]) ?? 0, // H: 초고잔가
    yucaHighRate: asNumber(infoRows[feeStartIdx + 2]?.[4]) ?? 0.0077,
    yucaSuperHighRate: asNumber(infoRows[feeStartIdx + 2]?.[6]) ?? 0,
    samilHighFee: asNumber(infoRows[feeStartIdx + 3]?.[4]) ?? 528000,
    samilSuperHighBaseFee: asNumber(infoRows[feeStartIdx + 3]?.[6]) ?? 528000,
    samilSuperHighVehicleRate: asNumber(infoRows[feeStartIdx + 4]?.[6]) ?? 0.011,
    samilHighBrands: parseSamilHighBrands(infoRows),
  };
}

function parseSamilHighBrands(infoRows: unknown[][]): string[] {
  // Find "삼일 고잔가 적용 브랜드" label at D column (idx 2)
  const brands: string[] = [];
  let startIdx = -1;
  for (let i = 0; i < infoRows.length; i++) {
    const label = asText(infoRows[i]?.[2]);
    if (label?.includes("삼일") && label?.includes("고잔가") && label?.includes("브랜드")) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx < 0) return SAMIL_HIGH_RV_BRANDS_DEFAULT;

  for (let i = startIdx; i < startIdx + 15; i++) {
    const brand = asText(infoRows[i]?.[2]); // D column = idx 2
    const enabled = infoRows[i]?.[3]; // E column = idx 3
    if (!brand) break;
    if (enabled === true) brands.push(brand);
  }
  return brands.length > 0 ? brands : SAMIL_HIGH_RV_BRANDS_DEFAULT;
}

const SAMIL_HIGH_RV_BRANDS_DEFAULT = [
  "Audi", "Benz", "BMW", "Lexus", "Porsche",
  "Volkswagen", "Volvo", "BYD", "Tesla", "Landrover",
];

// ---------------------------------------------------------------------------
// Mileage Adjustment Table Parser
// ---------------------------------------------------------------------------

export type WooriMileageAdjustments = {
  [km: number]: { samil: number; yuca: number; autohands: number };
};

function parseMileageAdjustments(workbook: XLSX.WorkBook): WooriMileageAdjustments {
  // From 1.운용리스(비교) BU146:BY151
  const rows = sheetToRows(workbook, "1.운용리스(비교)");
  const result: WooriMileageAdjustments = {};

  // BU column = idx 72, BW = 74, BX = 75, BY = 76
  // Rows 146-151 (idx 145-150)
  for (let i = 145; i <= 150; i++) {
    const row = rows[i];
    if (!row) continue;
    const km = asNumber(row[72]);
    if (km == null) continue;

    result[km] = {
      samil: asNumber(row[74]) ?? 0,
      yuca: asNumber(row[75]) ?? 0,
      autohands: asNumber(row[76]) ?? 0,
    };
  }

  // Fallback defaults if sheet parsing failed
  if (Object.keys(result).length === 0) {
    return {
      10000: { samil: 0.06, yuca: 0.04, autohands: 0.11 },
      20000: { samil: 0.03, yuca: 0.02, autohands: 0.09 },
      25000: { samil: 0.02, yuca: 0.01, autohands: 0.05 },
      30000: { samil: 0, yuca: 0, autohands: 0 },
      40000: { samil: -0.03, yuca: -0.03, autohands: -1 },
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Minimum Residual Rates Parser
// ---------------------------------------------------------------------------

export type WooriMinResidualRates = Partial<Record<12 | 24 | 36 | 48 | 60, number>>;

function parseMinResidualRates(infoRows: unknown[][]): WooriMinResidualRates {
  // Find "최소잔가율" label at D column (idx 2)
  const result: WooriMinResidualRates = {};
  const terms = [12, 24, 36, 48, 60] as const;

  for (let i = 0; i < infoRows.length; i++) {
    const label = asText(infoRows[i]?.[2]);
    if (label?.includes("최소잔가율")) {
      // Next row has term numbers, row after that has rates
      const rateRowIdx = i + 2;
      for (let t = 0; t < terms.length; t++) {
        const rate = asNumber(infoRows[rateRowIdx]?.[2 + t]); // D=2, E=3, F=4, G=5, H=6
        if (rate != null) result[terms[t]] = rate;
      }
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// EV Tax Exemption Parser
// ---------------------------------------------------------------------------

export type WooriEvTaxExemptions = {
  lightCar: number; // 경차
  ev: number; // 전기
  hydrogen: number; // 수소
  hev: number; // HEV
};

function parseEvTaxExemptions(infoRows: unknown[][]): WooriEvTaxExemptions {
  // Find "취득세 감면액" label at D column (idx 2), then read values 2 rows below
  for (let i = 0; i < infoRows.length; i++) {
    const label = asText(infoRows[i]?.[2]);
    if (label?.includes("취득세") && label?.includes("감면액")) {
      // Row i+1: headers (경차, 전기, 수소, HEV)
      // Row i+2: values
      const valRow = i + 2;
      return {
        lightCar: asNumber(infoRows[valRow]?.[2]) ?? 750000, // D
        ev: asNumber(infoRows[valRow]?.[3]) ?? 1400000, // E
        hydrogen: asNumber(infoRows[valRow]?.[4]) ?? 1400000, // F
        hev: asNumber(infoRows[valRow]?.[5]) ?? 0, // G
      };
    }
  }
  return { lightCar: 750000, ev: 1400000, hydrogen: 1400000, hev: 0 };
}

// ---------------------------------------------------------------------------
// Main Parse Function
// ---------------------------------------------------------------------------

export function parseWooriWorkbook(
  input: ArrayBuffer,
  options: ParseWorkbookOptions
): WorkbookPreview {
  const workbook = XLSX.read(input, { type: "array", cellFormula: false });
  const lenderCode = options.lenderCode || "woori-card";
  const fileName = options.fileName || "unknown.xlsx";

  const vehiclePrograms = parseVehiclePrograms(workbook);
  const residualMatrixRows = parseResidualMatrixRows(workbook);
  const brandRatePolicies = parseBrandRatePolicies(workbook);

  return {
    lenderCode,
    lenderName: "우리카드",
    sourceFileName: fileName,
    detectedVersionLabel: detectVersionLabel(workbook),
    sheetNames: workbook.SheetNames,
    analysis: {
      hasVehicleDb: vehiclePrograms.length > 0,
      hasResidualMap: residualMatrixRows.length > 0,
      hasBrandRatePolicies: brandRatePolicies.length > 0,
      vehicleProgramCount: vehiclePrograms.length,
      residualMatrixRowCount: residualMatrixRows.length,
      brandRatePolicyCount: brandRatePolicies.length,
    },
    vehiclePrograms,
    residualMatrixRows,
    brandRatePolicies,
    sheetContracts: { operatingLease: null },
  };
}

function detectVersionLabel(workbook: XLSX.WorkBook): string {
  // 중요정보 G41 = "견적 Version" label nearby, G column = idx 5 (relative to B=0)
  const rows = sheetToRows(workbook, "중요정보");
  for (let i = 0; i < rows.length; i++) {
    const label = asText(rows[i]?.[5]); // G column
    if (label?.includes("Version") || label?.includes("통합")) {
      return label;
    }
  }
  return "woori-card-unknown";
}

// Also export helper parsers for the engine to use during import
export {
  parseRvGuaranteeFees,
  parseMileageAdjustments,
  parseMinResidualRates,
  parseEvTaxExemptions,
};
