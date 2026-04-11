import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import * as XLSX from "xlsx";

type CliOptions = {
  workbook: string;
  brand: string;
  model: string;
  ownership: "company" | "customer";
  term: 12 | 24 | 36 | 48 | 60;
  annualMileageKm: 10000 | 15000 | 20000 | 30000 | 40000;
  vehiclePrice: number;
  discountAmount: number;
  upfrontPayment: number;
  depositAmount: number;
  cmFeeRate: number;
  agFeeRate: number;
  irrOverride: number;
  residualMode: "standard" | "high";
  dealerName: string | null;
  importCategory: "수입" | "국산";
  residualOverrideMode: "auto" | "amount" | "ratio";
  residualOverrideValue: number;
};

type VehicleRow = {
  brand: string;
  modelName: string;
  lookupName: string; // CDB col J "차량명" — Es1 VLOOKUP key (includes year suffix)
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
  modelYear: number | null;
  cbGrade: number | string | null;
  tyGrade: number | string | null;
  jyGrade: number | string | null;
  crGrade: number | string | null;
  adbGrade: number | string | null;
};

// name!G2:G6 = [60, 48, 36, 24, 12], and Es1!B40 = INDEX(name!G2:G6, B39).
const TERM_INDEX: Record<number, number> = { 60: 1, 48: 2, 36: 3, 24: 4, 12: 5 };
const MILEAGE_INDEX: Record<number, number> = {
  10000: 1,
  15000: 2,
  20000: 3,
  30000: 4,
  40000: 5,
};

function parseArgs(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    workbook:
      "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm",
    brand: "BMW",
    model: "The New 5 Series 가솔린 2.0 520i",
    ownership: "company",
    term: 60,
    annualMileageKm: 20000,
    vehiclePrice: 110000000,
    discountAmount: 0,
    upfrontPayment: 0,
    depositAmount: 0,
    cmFeeRate: 0,
    agFeeRate: 0,
    irrOverride: 0,
    residualMode: "standard",
    dealerName: null,
    importCategory: "수입" as const,
    residualOverrideMode: "auto",
    residualOverrideValue: 0,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (!rawKey || rawValue == null) continue;

    switch (rawKey) {
      case "workbook":
        defaults.workbook = rawValue;
        break;
      case "brand":
        defaults.brand = rawValue;
        break;
      case "model":
        defaults.model = rawValue;
        break;
      case "ownership":
        defaults.ownership = rawValue === "customer" ? "customer" : "company";
        break;
      case "term":
        defaults.term = Number(rawValue) as CliOptions["term"];
        break;
      case "annualMileageKm":
        defaults.annualMileageKm = Number(rawValue) as CliOptions["annualMileageKm"];
        break;
      case "vehiclePrice":
        defaults.vehiclePrice = Number(rawValue);
        break;
      case "discountAmount":
        defaults.discountAmount = Number(rawValue);
        break;
      case "upfrontPayment":
        defaults.upfrontPayment = Number(rawValue);
        break;
      case "depositAmount":
        defaults.depositAmount = Number(rawValue);
        break;
      case "cmFeeRate":
        defaults.cmFeeRate = Number(rawValue);
        break;
      case "agFeeRate":
        defaults.agFeeRate = Number(rawValue);
        break;
      case "irrOverride":
        defaults.irrOverride = Number(rawValue);
        break;
      case "residualMode":
        defaults.residualMode = rawValue === "high" ? "high" : "standard";
        break;
      case "dealerName":
        defaults.dealerName = rawValue || null;
        break;
      case "importCategory":
        defaults.importCategory = rawValue === "국산" ? "국산" : "수입";
        break;
      case "residualOverrideMode":
        defaults.residualOverrideMode =
          rawValue === "amount" || rawValue === "ratio" ? rawValue : "auto";
        break;
      case "residualOverrideValue":
        defaults.residualOverrideValue = Number(rawValue);
        break;
      default:
        break;
    }
  }

  return defaults;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replaceAll(",", "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asGrade(value: unknown): number | string | null {
  const n = asNumber(value);
  if (n != null) return n;
  return asText(value);
}

function readVehicleRow(workbookPath: string, brand: string, model: string): VehicleRow {
  const workbook = XLSX.readFile(workbookPath, { cellFormula: false });
  const sheet = workbook.Sheets["CDB"];
  if (!sheet) throw new Error("CDB sheet not found.");

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  }) as unknown[][];

  let best: VehicleRow | null = null;
  let bestYear = -Infinity;

  for (const row of rows.slice(3)) {
    const rowBrand = asText(row[4]);
    const rowModel = asText(row[6]);
    if (!rowBrand || !rowModel) continue;
    if (rowBrand !== brand || rowModel !== model) continue;

    const modelYear = asNumber(row[7]) ?? 0;
    if (modelYear < bestYear) continue;

    const year = asNumber(row[7]);
    // CDB col J "차량명" is a formula Excel computes as `{차명(세부)} {년식}년형`.
    // XLSX reads it as null, so construct it ourselves — Es1!W7 VLOOKUP searches
    // this exact string.
    const lookupName = year != null ? `${rowModel} ${year}년형` : rowModel;
    best = {
      brand: rowBrand,
      modelName: rowModel,
      lookupName,
      vehicleClass: asText(row[12]),
      engineDisplacementCc: asNumber(row[13]),
      modelYear: year,
      cbGrade: asGrade(row[8]),
      tyGrade: asGrade(row[14]),
      jyGrade: asGrade(row[16]),
      crGrade: asGrade(row[18]),
      adbGrade: asGrade(row[20]),
    };
    bestYear = modelYear;
  }

  if (!best) throw new Error(`Vehicle '${brand} ${model}' not found in CDB.`);
  return best;
}

function runExcelScenario(options: CliOptions & { lookupName: string }) {
  const tempDir = mkdtempSync(`${tmpdir()}/bnk-fixture-`);
  // Use a unique ASCII-only filename to avoid basename collisions with any
  // workbook the user has open and to sidestep Korean-path quirks in
  // AppleScript/Excel interop.
  const tempWorkbookPath = `${tempDir}/bnk-harness-${process.pid}-${Date.now()}.xlsm`;
  cpSync(options.workbook, tempWorkbookPath);

  const workbookName = basename(tempWorkbookPath);
  const termIdx = TERM_INDEX[options.term];
  const mileageIdx = MILEAGE_INDEX[options.annualMileageKm];
  if (!termIdx || !mileageIdx) {
    throw new Error(`Invalid term/mileage: ${options.term}/${options.annualMileageKm}`);
  }

  const ownershipCode = options.ownership === "company" ? 1 : 2;
  // B137/B138 are boolean cells; true switches to "amount" mode.
  const depositModeFlag = options.depositAmount > 0 ? "true" : "false";
  const upfrontModeFlag = options.upfrontPayment > 0 ? "true" : "false";
  const highRvFlag = options.residualMode === "high" ? "true" : "false";
  const importCode = options.importCategory === "수입" ? 1 : 2;
  const escapedModel = options.lookupName.replaceAll('"', '\\"');
  const residualOverrideActive = options.residualOverrideMode !== "auto";
  const residualModeFlag = residualOverrideActive ? "true" : "false";
  // B73 = INDEX(G70:G71, code). Inspection: G70="%", G71="금액".
  // So code 1 = ratio (%), code 2 = amount (금액).
  const residualModeCode = options.residualOverrideMode === "ratio" ? 1 : 2;
  // 운용리스견적!N34 holds the override value — raw won if amount, percent*100 if ratio
  const residualN34 = residualOverrideActive
    ? options.residualOverrideMode === "ratio"
      ? options.residualOverrideValue * 100 // 0.55 → 55
      : options.residualOverrideValue
    : 0;

  const scriptLines = [
    `set workbookPath to POSIX file "${tempWorkbookPath}"`,
    'tell application "Microsoft Excel"',
    "activate",
    "open workbook workbook file name workbookPath",
    "delay 2",
    "set wb to active workbook",
    'tell worksheet "운용리스견적" of wb',
    `set value of range "N5" to ${importCode}`,
    `set value of range "N13" to ${options.vehiclePrice}`,
    `set value of range "N15" to ${options.discountAmount}`,
    `set value of range "N34" to ${residualN34}`,
    `set value of range "N37" to ${options.depositAmount}`,
    `set value of range "N39" to ${options.upfrontPayment}`,
    `set value of range "N41" to ${options.agFeeRate}`,
    `set value of range "N42" to ${options.cmFeeRate}`,
    `set value of range "U45" to ${options.irrOverride}`,
    "end tell",
    'tell worksheet "Es1" of wb',
    `set value of range "B17" to "${escapedModel}"`,
    `set value of range "B20" to "${escapedModel}"`,
    `set value of range "B26" to ${ownershipCode}`,
    `set value of range "B39" to ${termIdx}`,
    `set value of range "B41" to ${mileageIdx}`,
    `set value of range "B71" to ${highRvFlag}`,
    `set value of range "B73" to ${residualModeCode}`,
    `set value of range "B136" to ${residualModeFlag}`,
    `set value of range "B137" to ${depositModeFlag}`,
    `set value of range "B138" to ${upfrontModeFlag}`,
    ...(options.dealerName
      ? [`set value of range "B156" to "${options.dealerName.replaceAll('"', '\\"')}"`]
      : []),
    "end tell",
    "calculate",
    "delay 2",
    "calculate",
    "delay 1",
    'tell worksheet "Es1" of wb',
    'set outputText to ((value of range "B167") as text) & "|" & ((value of range "B168") as text) & "|" & ((value of range "B134") as text) & "|" & ((value of range "B70") as text) & "|" & ((value of range "B101") as text) & "|" & ((value of range "B87") as text) & "|" & ((value of range "B166") as text) & "|" & ((value of range "B40") as text)',
    "end tell",
    "close wb saving no",
    "end tell",
    "return outputText",
  ];

  try {
    const output = execFileSync(
      "osascript",
      scriptLines.flatMap((line) => ["-e", line]),
      { encoding: "utf8" },
    ).trim();

    const values = output.split("|");
    return {
      displayedAnnualRateDecimal: Number(values[0]),
      monthlyPayment: Number(values[1]),
      acquisitionCost: Number(values[2]),
      residualAmount: Number(values[3]),
      acquisitionTax: Number(values[4]),
      discountedVehiclePrice: Number(values[5]),
      baseIrrRate: Number(values[6]),
      termMonths: Number(values[7]),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const options = parseArgs(process.argv.slice(2));
const workbookVersion = basename(options.workbook).replace(/\.xlsm$/i, "");
const vehicle = readVehicleRow(options.workbook, options.brand, options.model);
const expected = runExcelScenario({ ...options, lookupName: vehicle.lookupName });

const financedPrincipal =
  expected.discountedVehiclePrice + expected.acquisitionTax;

const fixture = {
  name: `bnk-${options.brand.toLowerCase()}-${options.model
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")}-${options.term}m`,
  workbookVersion,
  vehicle: {
    brand: vehicle.brand,
    modelName: vehicle.modelName,
    vehicleClass: vehicle.vehicleClass,
    engineDisplacementCc: vehicle.engineDisplacementCc,
    rawRow: {
      cbGrade: vehicle.cbGrade,
      tyGrade: vehicle.tyGrade,
      jyGrade: vehicle.jyGrade,
      crGrade: vehicle.crGrade,
      adbGrade: vehicle.adbGrade,
      modelYear: vehicle.modelYear,
      vehicleClass: vehicle.vehicleClass,
    },
  },
  input: {
    lenderCode: "bnk-capital",
    productType: "operating_lease",
    brand: options.brand,
    modelName: options.model,
    ownershipType: options.ownership,
    leaseTermMonths: options.term,
    annualMileageKm: options.annualMileageKm,
    upfrontPayment: options.upfrontPayment,
    depositAmount: options.depositAmount,
    quotedVehiclePrice: options.vehiclePrice,
    discountAmount: options.discountAmount,
    cmFeeRate: options.cmFeeRate,
    agFeeRate: options.agFeeRate,
    residualMode: options.residualMode,
    dealerName: options.dealerName ?? undefined,
    annualIrrRateOverride: options.irrOverride > 0 ? options.irrOverride : undefined,
    residualOverrideMode:
      options.residualOverrideMode === "auto" ? undefined : options.residualOverrideMode,
    residualOverrideValue:
      options.residualOverrideMode === "auto" ? undefined : options.residualOverrideValue,
  },
  expected: {
    discountedVehiclePrice: expected.discountedVehiclePrice,
    acquisitionTax: expected.acquisitionTax,
    stampDuty: 0,
    financedPrincipal,
    residualAmount: expected.residualAmount,
    displayedAnnualRateDecimal: expected.displayedAnnualRateDecimal,
    effectiveAnnualRateDecimal: expected.baseIrrRate,
    monthlyPayment: expected.monthlyPayment,
  },
  debug: {
    acquisitionCost: expected.acquisitionCost,
    termMonthsFromExcel: expected.termMonths,
  },
  tolerance: {
    monthlyPayment: 1,
    residualAmount: 0,
    acquisitionTax: 0,
  },
};

console.log(JSON.stringify(fixture, null, 2));
