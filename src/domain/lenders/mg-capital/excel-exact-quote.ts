import { existsSync, mkdirSync, statSync, copyFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { and, desc, eq } from "drizzle-orm";

import { workbookImports, vehiclePrograms } from "@/db/schema";
import type { CanonicalQuoteInput, CanonicalQuoteResult } from "@/domain/quotes/types";
import { createDbClient } from "@/lib/db/client";

const SOURCE_WORKBOOK_PATH = path.join(
  process.cwd(),
  "reference",
  "★MG캐피탈_수입견적_26.03월_외부용_2603_vol1.xlsx",
);
const RUNTIME_WORKBOOK_PATH = "/tmp/mg-operating-lease-exact.xlsx";
const WORKBOOK_NAME = path.basename(RUNTIME_WORKBOOK_PATH);
const WORKSHEET_NAME = "운용리스";
const execFileAsync = promisify(execFile);

type ExactWorkbookValues = {
  basicVehiclePrice: number;
  contractPrice: number;
  acquisitionTax: number;
  acquisitionCost: number;
  monthlyPayment: number;
  annualRateDecimal: number;
  minResidualRateDecimal: number;
  maxResidualRateDecimal: number;
  residualAmount: number;
  residualGuaranteeFeeAmount: number;
  agFeeAmount: number;
  cmFeeAmount: number;
};

function parseNumeric(value: string | null): number | null {
  if (value == null) {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toWorkbookPercent(value: number | undefined): number {
  if (value == null) {
    return 0;
  }

  return value > 1 ? value / 100 : value;
}

function toWorkbookMileageLabel(value: CanonicalQuoteInput["annualMileageKm"] | undefined): string {
  return `${value ?? 20000}km`;
}

function toWorkbookOwnership(value: CanonicalQuoteInput["ownershipType"]): string {
  return value === "company" ? "당사명의" : "이용자명의";
}

function toWorkbookResidualMode(value: CanonicalQuoteInput): {
  mode: "차량가비율" | "취득원가비율" | "금액입력";
  ratio: number;
  amount: number;
} {
  if (value.residualAmountOverride != null) {
    return {
      mode: "금액입력",
      ratio: 0,
      amount: value.residualAmountOverride,
    };
  }

  if (value.residualValueMode === "acquisition-cost-ratio") {
    return {
      mode: "취득원가비율",
      ratio: toWorkbookPercent(value.residualValueRatio),
      amount: 0,
    };
  }

  return {
    mode: "차량가비율",
    ratio: toWorkbookPercent(
      value.selectedResidualRateOverride ?? value.residualRateOverride ?? value.residualValueRatio ?? 0,
    ),
    amount: 0,
  };
}

function toWorkbookAcquisitionTaxMode(input: CanonicalQuoteInput): {
  mode: "자동반영" | "비율입력" | "감면액입력" | "금액입력";
  ratio: number;
  amount: number;
} {
  if (input.acquisitionTaxAmountOverride != null) {
    return { mode: "금액입력", ratio: 0, amount: input.acquisitionTaxAmountOverride };
  }

  if (input.acquisitionTaxReduction != null && input.acquisitionTaxReduction > 0) {
    return { mode: "감면액입력", ratio: 0, amount: input.acquisitionTaxReduction };
  }

  if (input.acquisitionTaxRateOverride != null) {
    return {
      mode: "비율입력",
      ratio: input.acquisitionTaxRateOverride,
      amount: 0,
    };
  }

  return {
    mode: "자동반영",
    ratio: 0.07,
    amount: 0,
  };
}

function ensureRuntimeWorkbook() {
  if (!existsSync(SOURCE_WORKBOOK_PATH)) {
    throw new Error(`Exact workbook file not found: ${SOURCE_WORKBOOK_PATH}`);
  }

  const runtimeDir = path.dirname(RUNTIME_WORKBOOK_PATH);
  mkdirSync(runtimeDir, { recursive: true });

  const shouldCopy =
    !existsSync(RUNTIME_WORKBOOK_PATH) ||
    statSync(SOURCE_WORKBOOK_PATH).mtimeMs > statSync(RUNTIME_WORKBOOK_PATH).mtimeMs;

  if (shouldCopy) {
    copyFileSync(SOURCE_WORKBOOK_PATH, RUNTIME_WORKBOOK_PATH);
  }
}

function buildAppleScript(input: CanonicalQuoteInput) {
  const residual = toWorkbookResidualMode(input);
  const acquisitionTax = toWorkbookAcquisitionTaxMode(input);
  const affiliateType = input.affiliateType ?? "비제휴사";
  const quotedVehiclePrice = input.quotedVehiclePrice ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const publicBondCost = input.includePublicBondCost === false ? 0 : input.publicBondCost ?? 0;
  const miscFeeAmount = input.includeMiscFeeAmount === false ? 0 : input.miscFeeAmount ?? 0;
  const deliveryFeeAmount = input.includeDeliveryFeeAmount === false ? 0 : input.deliveryFeeAmount ?? 0;
  const depositAmount = input.depositAmount ?? 0;
  const insuranceYearlyAmount = input.insuranceYearlyAmount ?? 0;
  const lossDamageAmount = input.lossDamageAmount ?? 0;
  const directModelEntry = input.directModelEntry === true;
  const affiliateExempt = affiliateType === "KCC면제";

  return [
    'tell application "Microsoft Excel"',
    `set wbPath to POSIX file "${RUNTIME_WORKBOOK_PATH}"`,
    "try",
    `set wb to workbook "${WORKBOOK_NAME}"`,
    "on error",
    "open wbPath",
    "delay 0.3",
    `set wb to workbook "${WORKBOOK_NAME}"`,
    "end try",
    `set ws to worksheet "${WORKSHEET_NAME}" of wb`,
    `set value of range "BY5" of ws to "${affiliateType}"`,
    `set value of range "CE8" of ws to ${affiliateExempt ? "true" : "false"}`,
    `set value of range "BD5" of ws to "${input.brand}"`,
    `set value of range "BD6" of ws to "${input.modelName}"`,
    `set value of range "CE7" of ws to ${directModelEntry ? "true" : "false"}`,
    `set value of range "BD7" of ws to "${input.manualVehicleClass ?? ""}"`,
    `set value of range "BD8" of ws to ${input.manualEngineDisplacementCc ?? 0}`,
    `set value of range "BD9" of ws to ${quotedVehiclePrice}`,
    'set value of range "BD12" of ws to "금액입력"',
    `set value of range "BQ12" of ws to ${discountAmount}`,
    `set value of range "BD15" of ws to "${toWorkbookOwnership(input.ownershipType)}"`,
    `set value of range "CE4" of ws to ${input.includePublicBondCost === false ? "false" : "true"}`,
    `set value of range "BD16" of ws to 0`,
    `set value of range "CE5" of ws to ${input.includeMiscFeeAmount === false ? "false" : "true"}`,
    `set value of range "BD17" of ws to ${miscFeeAmount}`,
    `set value of range "CE6" of ws to ${input.includeDeliveryFeeAmount === false ? "false" : "true"}`,
    `set value of range "BD18" of ws to ${deliveryFeeAmount}`,
    `set value of range "BD19" of ws to "${acquisitionTax.mode}"`,
    `set value of range "BK19" of ws to ${acquisitionTax.ratio}`,
    `set value of range "BQ19" of ws to ${acquisitionTax.amount}`,
    `set value of range "BD22" of ws to ${input.leaseTermMonths}`,
    `set value of range "BD23" of ws to ${input.upfrontPayment}`,
    `set value of range "BD24" of ws to ${depositAmount > 0 ? '"금액입력"' : '"차량가비율"'}`,
    `set value of range "BK24" of ws to ${depositAmount > 0 ? 0 : 0}`,
    `set value of range "BQ24" of ws to ${depositAmount}`,
    `set value of range "BD25" of ws to "차량가비율"`,
    'set value of range "BK25" of ws to 0',
    'set value of range "BQ25" of ws to 0',
    `set value of range "BD26" of ws to "${toWorkbookMileageLabel(input.annualMileageKm)}"`,
    `set value of range "BD27" of ws to "${residual.mode === "금액입력" ? "차량가비율" : residual.mode}"`,
    `set value of range "BK27" of ws to ${residual.ratio}`,
    `set value of range "BD30" of ws to ${toWorkbookPercent(input.agFeeRate)}`,
    `set value of range "BD31" of ws to ${toWorkbookPercent(input.cmFeeRate)}`,
    `set value of range "BD34" of ws to ${lossDamageAmount}`,
    "calculate workbook wb",
    "delay 0.3",
    'set outputParts to {¬',
    '  (value of range "BD10" of ws) as string, ¬',
    '  (value of range "BD14" of ws) as string, ¬',
    '  (value of range "K15" of ws) as string, ¬',
    '  (value of range "K19" of ws) as string, ¬',
    '  (value of range "CQ32" of ws) as string, ¬',
    '  (value of range "BD37" of ws) as string, ¬',
    '  (value of range "BK28" of ws) as string, ¬',
    '  (value of range "BK29" of ws) as string, ¬',
    '  (value of range "CI42" of ws) as string, ¬',
    '  (value of range "CI55" of ws) as string, ¬',
    '  (value of range "CI56" of ws) as string, ¬',
    '  (value of range "CI57" of ws) as string ¬',
    "}",
    'set AppleScript\'s text item delimiters to "|"',
    "return outputParts as string",
    "end tell",
  ];
}

async function runAppleScript(lines: string[]): Promise<string> {
  const scriptPath = path.join("/tmp", `mg-exact-${Date.now()}.applescript`);
  writeFileSync(scriptPath, `${lines.join("\n")}\n`, "utf8");

  try {
    const { stdout, stderr } = await execFileAsync("/bin/zsh", ["-lc", `osascript ${scriptPath}`], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
    });

    if (stderr?.trim()) {
      throw new Error(stderr.trim());
    }

    return stdout.trim();
  } finally {
    try {
      unlinkSync(scriptPath);
    } catch {
      // ignore cleanup failures for tmp script files
    }
  }
}

async function readExactWorkbookValues(input: CanonicalQuoteInput): Promise<ExactWorkbookValues> {
  ensureRuntimeWorkbook();
  const raw = await runAppleScript(buildAppleScript(input));
  const [
    basicVehiclePrice,
    contractPrice,
    acquisitionTax,
    acquisitionCost,
    monthlyPayment,
    annualRateDecimal,
    minResidualRateDecimal,
    maxResidualRateDecimal,
    residualAmount,
    residualGuaranteeFeeAmount,
    agFeeAmount,
    cmFeeAmount,
  ] = raw.split("|").map((value) => parseNumeric(value) ?? 0);

  return {
    basicVehiclePrice,
    contractPrice,
    acquisitionTax,
    acquisitionCost,
    monthlyPayment,
    annualRateDecimal,
    minResidualRateDecimal,
    maxResidualRateDecimal,
    residualAmount,
    residualGuaranteeFeeAmount,
    agFeeAmount,
    cmFeeAmount,
  };
}

export async function calculateMgOperatingLeaseQuoteFromExcelWorkbook(params: {
  databaseUrl: string;
  input: CanonicalQuoteInput;
}): Promise<CanonicalQuoteResult | null> {
  if (typeof Bun === "undefined") {
    return null;
  }

  const { databaseUrl, input } = params;

  if (input.directModelEntry) {
    return null;
  }

  if ((input.includePublicBondCost !== false && (input.publicBondCost ?? 0) > 0) || input.residualAmountOverride != null) {
    return null;
  }

  if ((input.insuranceYearlyAmount ?? 0) > 0) {
    return null;
  }
  const { db, dispose } = createDbClient(databaseUrl);

  try {
    const [activeImport] = await db
      .select({
        id: workbookImports.id,
        versionLabel: workbookImports.versionLabel,
      })
      .from(workbookImports)
      .where(and(eq(workbookImports.lenderCode, input.lenderCode), eq(workbookImports.isActive, true)))
      .orderBy(desc(workbookImports.importedAt))
      .limit(1);

    if (!activeImport) {
      return null;
    }

    const [vehicle] = await db
      .select({
        brand: vehiclePrograms.brand,
        modelName: vehiclePrograms.modelName,
        vehiclePrice: vehiclePrograms.vehiclePrice,
        vehicleClass: vehiclePrograms.vehicleClass,
        engineDisplacementCc: vehiclePrograms.engineDisplacementCc,
        highResidualAllowed: vehiclePrograms.highResidualAllowed,
        hybridAllowed: vehiclePrograms.hybridAllowed,
        residualPromotionCode: vehiclePrograms.residualPromotionCode,
        snkResidualBand: vehiclePrograms.snkResidualBand,
      })
      .from(vehiclePrograms)
      .where(
        and(
          eq(vehiclePrograms.workbookImportId, activeImport.id),
          eq(vehiclePrograms.brand, input.brand),
          eq(vehiclePrograms.modelName, input.modelName),
        ),
      )
      .limit(1);

    if (!vehicle) {
      return null;
    }

    const exact = await readExactWorkbookValues(input);
    const vehiclePrice = exact.basicVehiclePrice || parseNumeric(vehicle.vehiclePrice) || input.quotedVehiclePrice || 0;
    const contractPrice = exact.contractPrice || vehiclePrice;
    const residualAmount = exact.residualAmount;
    const appliedResidualRateDecimal = contractPrice > 0 ? residualAmount / contractPrice : 0;
    const upfrontPayment = Math.max(0, input.upfrontPayment);
    const depositAmount = Math.max(0, input.depositAmount ?? 0);
    const agFeeAmount = exact.agFeeAmount;
    const cmFeeAmount = exact.cmFeeAmount;
    const extraFees =
      (input.includePublicBondCost === false ? 0 : input.publicBondCost ?? 0) +
      (input.includeMiscFeeAmount === false ? 0 : input.miscFeeAmount ?? 0) +
      (input.includeDeliveryFeeAmount === false ? 0 : input.deliveryFeeAmount ?? 0) +
      agFeeAmount +
      cmFeeAmount +
      exact.residualGuaranteeFeeAmount;

    return {
      lenderCode: input.lenderCode,
      productType: input.productType,
      workbookImport: activeImport,
      resolvedVehicle: {
        brand: vehicle.brand,
        modelName: vehicle.modelName,
        vehiclePrice,
        vehicleClass: vehicle.vehicleClass,
        engineDisplacementCc: vehicle.engineDisplacementCc,
        highResidualAllowed: vehicle.highResidualAllowed,
        hybridAllowed: vehicle.hybridAllowed,
        snkResidualBand: vehicle.snkResidualBand,
        residualPromotionCode: vehicle.residualPromotionCode,
      },
      majorInputs: {
        ownershipType: input.ownershipType,
        leaseTermMonths: input.leaseTermMonths,
        vehiclePrice,
        discountedVehiclePrice: contractPrice,
        upfrontPayment,
        depositAmount,
        financedPrincipal: exact.acquisitionCost,
      },
      feesAndTaxes: {
        acquisitionTax: exact.acquisitionTax,
        registrationTax: 0,
        publicBondCost: input.includePublicBondCost === false ? 0 : input.publicBondCost ?? 0,
        stampDuty: 10000,
        extraFees,
      },
      residual: {
        matrixGroup: null,
        source: input.selectedResidualRateOverride != null ? "override" : "residual-matrix",
        rateDecimal: appliedResidualRateDecimal,
        amount: residualAmount,
        minRateDecimal: exact.minResidualRateDecimal,
        maxRateDecimal: exact.maxResidualRateDecimal,
      },
      rates: {
        source: "excel-workbook",
        annualRateDecimal: exact.annualRateDecimal,
        effectiveAnnualRateDecimal: exact.annualRateDecimal,
        monthlyRateDecimal: exact.annualRateDecimal / 12,
      },
      monthlyPayment: exact.monthlyPayment,
      warnings: [],
    };
  } finally {
    await dispose();
  }
}
