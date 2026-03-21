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
  annualMileageKm: 10000 | 20000 | 30000 | 35000;
  vehiclePrice: number;
  discountAmount: number;
  upfrontPayment: number;
  depositAmount: number;
};

type VehicleRow = {
  vehiclePrice: string;
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
  highResidualAllowed: boolean | null;
  hybridAllowed: boolean | null;
  residualPromotionCode: string | null;
  snkResidualBand: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    workbook:
      "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제.xlsx",
    brand: "BMW",
    model: "X7 xDrive 40d DPE (6인승)",
    ownership: "company",
    term: 36,
    annualMileageKm: 20000,
    vehiclePrice: 500000000,
    discountAmount: 8500000,
    upfrontPayment: 0,
    depositAmount: 0,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (!rawKey || rawValue == null) {
      continue;
    }

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
      default:
        break;
    }
  }

  return defaults;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replaceAll(",", "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function readVehicleRow(workbookPath: string, brand: string, model: string): VehicleRow {
  const workbook = XLSX.readFile(workbookPath, { cellFormula: false });
  const sheet = workbook.Sheets["차량DB"];
  if (!sheet) {
    throw new Error("차량DB sheet not found.");
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  }) as unknown[][];

  for (const row of rows.slice(5)) {
    if (asText(row[4]) !== brand || asText(row[5]) !== model) {
      continue;
    }

    return {
      vehiclePrice: String(asNumber(row[8]) ?? 0),
      vehicleClass: asText(row[7]),
      engineDisplacementCc: asNumber(row[6]),
      highResidualAllowed: asText(row[15]) === "Y",
      hybridAllowed: asText(row[16]) === "Y",
      residualPromotionCode: asText(row[17]),
      snkResidualBand: asText(row[18]),
    };
  }

  throw new Error(`Vehicle '${brand} ${model}' not found in 차량DB.`);
}

function runExcelScenario(options: CliOptions) {
  const tempDir = mkdtempSync(`${tmpdir()}/mg-fixture-`);
  const tempWorkbookPath = `${tempDir}/${basename(options.workbook)}`;
  cpSync(options.workbook, tempWorkbookPath);

  const workbookName = basename(tempWorkbookPath);
  const ownershipLabel = options.ownership === "company" ? "당사명의" : "고객명의";

  const scriptLines = [
    `set workbookPath to POSIX file "${tempWorkbookPath}"`,
    'tell application "Microsoft Excel"',
    "activate",
    "open workbook workbook file name workbookPath",
    "delay 2",
    `set wb to workbook "${workbookName}"`,
    'tell worksheet "운용리스" of wb',
    `set value of range "BD5" to "${options.brand}"`,
    `set value of range "BD6" to "${options.model}"`,
    `set value of range "BD9" to ${options.vehiclePrice}`,
    `set value of range "BD15" to "${ownershipLabel}"`,
    `set value of range "BD22" to ${options.term}`,
    `set value of range "BD26" to ${options.annualMileageKm}`,
    `set value of range "CE13" to ${options.discountAmount}`,
    `set value of range "CI26" to ${options.upfrontPayment}`,
    `set value of range "CI28" to ${options.depositAmount}`,
    "calculate",
    "delay 1",
    'set outputText to ((value of range "CI9") as text) & "|" & ((value of range "CI21") as text) & "|" & ((value of range "CI81") as text) & "|" & ((value of range "CP17") as text) & "|" & ((value of range "CI42") as text) & "|" & ((value of range "CI25") as text) & "|" & ((value of range "CM4") as text) & "|" & ((value of range "CQ28") as text) & "|" & ((value of range "CQ32") as text)',
    'set debugText to ((value of range "BK27") as text) & "|" & ((value of range "BK29") as text) & "|" & ((value of range "BZ29") as text) & "|" & ((value of range "CO62") as text) & "|" & ((value of range "CP62") as text) & "|" & ((value of range "CQ62") as text)',
    "end tell",
    "close wb saving no",
    "end tell",
    'return outputText & "|" & debugText',
  ];

  try {
    const output = execFileSync("osascript", scriptLines.flatMap((line) => ["-e", line]), {
      encoding: "utf8",
    }).trim();

    const values = output.split("|");
    const discountedVehiclePrice = Number(values[0]);
    const acquisitionTax = Number(values[1]);
    const stampDuty = Number(values[2]);
    const financedPrincipal = Number(values[3]);
    const residualAmount = Number(values[4]);
    const displayedAnnualRateDecimal = Number(values[5]);
    const effectiveAnnualRateDecimal = Number(values[6]);
    const paymentRateOverride = Number(values[7]);
    const monthlyPayment = Number(values[8]);
    const selectedResidualRatio = Number(values[9]);
    const maxResidualRatio = Number(values[10]);
    const residualGapRatio = Number(values[11]);
    const residualGuaranteeCompany = values[12];
    const guaranteeBaseRatio = Number(values[13]);
    const guaranteePromoRatio = Number(values[14]);

    return {
      discountedVehiclePrice,
      acquisitionTax,
      stampDuty,
      financedPrincipal,
      residualAmount,
      displayedAnnualRateDecimal,
      effectiveAnnualRateDecimal,
      paymentRateOverride,
      monthlyPayment,
      selectedResidualRatio,
      maxResidualRatio,
      residualGapRatio,
      residualGuaranteeCompany,
      guaranteeBaseRatio,
      guaranteePromoRatio,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const options = parseArgs(process.argv.slice(2));
const workbookVersion = basename(options.workbook).replace(/\.xlsx$/i, "");
const vehicle = readVehicleRow(options.workbook, options.brand, options.model);
const expected = runExcelScenario(options);

const fixture = {
  name: `${options.brand.toLowerCase()}-${options.model.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")}-${options.term}m`,
  workbookVersion,
  workbookDebug: {
    selectedResidualRatio: expected.selectedResidualRatio,
    maxResidualRatio: expected.maxResidualRatio,
    residualGapRatio: expected.residualGapRatio,
    residualGuaranteeCompany: expected.residualGuaranteeCompany,
    guaranteeBaseRatio: expected.guaranteeBaseRatio,
    guaranteePromoRatio: expected.guaranteePromoRatio,
  },
  vehicle,
  input: {
    lenderCode: "mg-capital",
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
    annualIrrRateOverride: expected.displayedAnnualRateDecimal,
    annualEffectiveRateOverride: expected.effectiveAnnualRateDecimal,
    paymentRateOverride: expected.paymentRateOverride,
    residualValueMode: "amount",
    residualAmountOverride: expected.residualAmount,
    acquisitionTaxRateOverride: 0.07,
    publicBondCost: 0,
    stampDuty: expected.stampDuty,
  },
  expected: {
    discountedVehiclePrice: expected.discountedVehiclePrice,
    acquisitionTax: expected.acquisitionTax,
    stampDuty: expected.stampDuty,
    financedPrincipal: expected.financedPrincipal,
    residualAmount: expected.residualAmount,
    displayedAnnualRateDecimal: expected.displayedAnnualRateDecimal,
    effectiveAnnualRateDecimal: expected.effectiveAnnualRateDecimal,
    monthlyPayment: expected.monthlyPayment,
  },
  tolerance: {
    monthlyPayment: 0,
    residualAmount: 0,
    acquisitionTax: 0,
  },
};

console.log(JSON.stringify(fixture, null, 2));
