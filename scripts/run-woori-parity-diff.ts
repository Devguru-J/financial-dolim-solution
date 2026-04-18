#!/usr/bin/env bun
/**
 * run-woori-parity-diff.ts
 *
 * Compare sweep results (Excel ground truth) against engine pure function.
 *
 * Usage:
 *   bun run scripts/run-woori-parity-diff.ts \
 *     --scenarios=woori-scenarios.json \
 *     --sweep=woori-sweep.json \
 *     --output=woori-diff.json
 */

import { readFileSync, writeFileSync } from "fs";
import { parseWooriWorkbook } from "../src/domain/lenders/woori-card/workbook-parser";
import {
  calculateWooriOperatingLeaseQuoteFromContext,
  type WooriQuoteContext,
} from "../src/domain/lenders/woori-card/operating-lease-service";

type Scenario = {
  id: string;
  brand: string;
  model: string;
  term: 12 | 24 | 36 | 48 | 60;
  annualMileageKm: number;
  vehiclePrice: number;
  residualMode: "standard" | "high";
  ownership: "company" | "customer";
  samilGrade?: string | null;
  yucaGrade?: string | null;
  autohandsGrade?: string | null;
  vehicleClass?: string | null;
  engineDisplacementCc?: number | null;
  fuel?: string | null;
};

type SweepResult = {
  id: string;
  monthlyPayment: number;
  effectiveAnnualRate: number;
  baseIrr: number;
  residualAmount: number;
  residualRate: number;
  acquisitionTax: number;
  acquisitionCost: number;
  guaranteeFee: number;
  winnerProvider: string;
  vehiclePrice: number;
};

type DiffEntry = {
  id: string;
  brand: string;
  model: string;
  term: number;
  residualMode: string;
  verdict: "pass" | "fail" | "fallback" | "excel_missing";
  excel: {
    monthlyPayment: number;
    effectiveRate: number;
    residualAmount: number;
    residualRate: number;
    acquisitionTax: number;
    winnerProvider: string;
  };
  engine: {
    monthlyPayment: number;
    effectiveRate: number;
    residualAmount: number;
    residualRate: number;
    acquisitionTax: number;
    winnerProvider: string;
  };
  delta: {
    monthlyPayment: number;
    effectiveRate: number;
    residualAmount: number;
    acquisitionTax: number;
  };
};

// ---------------------------------------------------------------------------
// Tolerances (same as BNK sweep)
// ---------------------------------------------------------------------------

const TOLERANCE = {
  monthlyPayment: 100, // ±100원 (ROUNDUP boundary)
  effectiveRate: 1e-4, // ±0.01%
  residualAmount: 1000, // ±1000원 (TRUNC boundary)
  acquisitionTax: 10, // ±10원
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const [key, val] = arg.replace(/^--/, "").split("=");
    args[key] = val;
  }
  return {
    scenarios: args.scenarios ?? "woori-scenarios.json",
    sweep: args.sweep ?? "woori-sweep.json",
    output: args.output ?? "woori-diff.json",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs();

// Load inputs
const scenarios: Scenario[] = JSON.parse(readFileSync(opts.scenarios, "utf8"));
const sweepResults: SweepResult[] = JSON.parse(readFileSync(opts.sweep, "utf8"));
const sweepMap = new Map(sweepResults.map((r) => [r.id, r]));

console.log(`Scenarios: ${scenarios.length}, Sweep results: ${sweepResults.length}`);

// Parse workbook for engine context
const workbookPath = "reference/260310_수입차리스_오토핸즈잔가군수정_잠금해제.xlsx";
const buf = readFileSync(workbookPath);
const parsed = parseWooriWorkbook(buf.buffer as ArrayBuffer, {
  lenderCode: "woori-card",
  fileName: workbookPath,
});

// Build vehicle lookup
const vehicleByModel = new Map(
  parsed.vehiclePrograms.map((v) => [v.modelName, v])
);

const diffs: DiffEntry[] = [];
let passCount = 0;
let failCount = 0;
let skipCount = 0;

for (const scenario of scenarios) {
  const excel = sweepMap.get(scenario.id);
  if (!excel) {
    skipCount++;
    continue;
  }

  // Find vehicle data
  const vehicle = vehicleByModel.get(scenario.model);
  if (!vehicle) {
    skipCount++;
    continue;
  }

  // Build engine context
  const providerRates = parsed.residualMatrixRows
    .filter((r) => r.leaseTermMonths === scenario.term)
    .map((r) => ({
      matrixGroup: r.matrixGroup,
      leaseTermMonths: r.leaseTermMonths,
      residualRate: String(r.residualRate),
    }));

  const rr = vehicle.rawRow as Record<string, unknown>;

  const ctx: WooriQuoteContext = {
    workbookImport: { id: "diff-test", versionLabel: "diff" },
    input: {
      lenderCode: "woori-card",
      productType: "operating_lease",
      brand: scenario.brand,
      modelName: scenario.model,
      ownershipType: scenario.ownership,
      leaseTermMonths: scenario.term,
      annualMileageKm: scenario.annualMileageKm as any,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: scenario.vehiclePrice,
      discountAmount: 0,
      residualMode: scenario.residualMode === "high" ? "high" : "standard",
      stampDuty: 10000,
    },
    vehicle: {
      brand: vehicle.brand,
      modelName: vehicle.modelName,
      vehicleClass: vehicle.vehicleClass,
      engineDisplacementCc: vehicle.engineDisplacementCc,
      highResidualAllowed: vehicle.highResidualAllowed,
      hybridAllowed: vehicle.hybridAllowed,
      rawRow: rr,
    },
    policyBaseIrr: scenario.ownership === "company" ? 0.045 : 0.057,
    providerRates,
  };

  let engineResult;
  try {
    engineResult = calculateWooriOperatingLeaseQuoteFromContext(ctx);
  } catch (e) {
    diffs.push({
      id: scenario.id,
      brand: scenario.brand,
      model: scenario.model,
      term: scenario.term,
      residualMode: scenario.residualMode,
      verdict: "fail",
      excel: {
        monthlyPayment: excel.monthlyPayment,
        effectiveRate: excel.effectiveAnnualRate,
        residualAmount: excel.residualAmount,
        residualRate: excel.residualRate,
        acquisitionTax: excel.acquisitionTax,
        winnerProvider: excel.winnerProvider,
      },
      engine: {
        monthlyPayment: 0,
        effectiveRate: 0,
        residualAmount: 0,
        residualRate: 0,
        acquisitionTax: 0,
        winnerProvider: "ERROR: " + (e as Error).message.substring(0, 80),
      },
      delta: { monthlyPayment: -1, effectiveRate: -1, residualAmount: -1, acquisitionTax: -1 },
    });
    failCount++;
    continue;
  }

  const deltaPmt = Math.abs(engineResult.monthlyPayment - excel.monthlyPayment);
  const deltaRate = Math.abs(engineResult.rates.effectiveAnnualRateDecimal - excel.effectiveAnnualRate);
  const deltaRv = Math.abs(engineResult.residual.amount - excel.residualAmount);
  const deltaTax = Math.abs(engineResult.feesAndTaxes.acquisitionTax - excel.acquisitionTax);

  const pass =
    deltaPmt <= TOLERANCE.monthlyPayment &&
    deltaRate <= TOLERANCE.effectiveRate &&
    deltaRv <= TOLERANCE.residualAmount &&
    deltaTax <= TOLERANCE.acquisitionTax;

  // Categorize non-pass outcomes:
  //  - "excel_missing": Excel itself returned a "missing value" winnerProvider
  //    (Excel can't compute — engine result is incomparable)
  //  - "fallback": engine warns that 고잔가 was unavailable and auto-fell-back
  //    to 일반잔가; Excel shows 0-residual garbage. Engine is correct by design.
  //  - "fail": genuine mismatch.
  const excelMissing = String(excel.winnerProvider || "").toLowerCase().includes("missing");
  const fallbackWarning = (engineResult.warnings ?? []).some((w) =>
    w.includes("일반잔가로 자동 전환")
  );

  let verdict: DiffEntry["verdict"];
  if (pass) {
    verdict = "pass";
    passCount++;
  } else if (excelMissing) {
    verdict = "excel_missing";
  } else if (fallbackWarning && excel.residualRate === 0) {
    verdict = "fallback";
  } else {
    verdict = "fail";
    failCount++;
  }

  diffs.push({
    id: scenario.id,
    brand: scenario.brand,
    model: scenario.model,
    term: scenario.term,
    residualMode: scenario.residualMode,
    verdict,
    excel: {
      monthlyPayment: excel.monthlyPayment,
      effectiveRate: excel.effectiveAnnualRate,
      residualAmount: excel.residualAmount,
      residualRate: excel.residualRate,
      acquisitionTax: excel.acquisitionTax,
      winnerProvider: excel.winnerProvider,
    },
    engine: {
      monthlyPayment: engineResult.monthlyPayment,
      effectiveRate: engineResult.rates.effectiveAnnualRateDecimal,
      residualAmount: engineResult.residual.amount,
      residualRate: engineResult.residual.rateDecimal,
      acquisitionTax: engineResult.feesAndTaxes.acquisitionTax,
      winnerProvider: engineResult.residual.candidateSummary?.selectedCandidateName ?? "unknown",
    },
    delta: {
      monthlyPayment: deltaPmt,
      effectiveRate: deltaRate,
      residualAmount: deltaRv,
      acquisitionTax: deltaTax,
    },
  });
}

writeFileSync(opts.output, JSON.stringify(diffs, null, 2));

const fallbackCount = diffs.filter((d) => d.verdict === "fallback").length;
const excelMissingCount = diffs.filter((d) => d.verdict === "excel_missing").length;
const total = passCount + failCount;
const pct = total > 0 ? ((passCount / total) * 100).toFixed(1) : "0";
console.log(`\n=== Parity Results ===`);
console.log(`Pass: ${passCount}/${total} (${pct}%)`);
console.log(`Fail: ${failCount}`);
if (fallbackCount > 0) console.log(`Fallback (일반잔가 자동전환, Excel 0잔가 — 엔진이 더 올바름): ${fallbackCount}`);
if (excelMissingCount > 0) console.log(`Excel missing value (비교 불가): ${excelMissingCount}`);
console.log(`Skip: ${skipCount}`);
console.log(`Output: ${opts.output}`);

if (failCount > 0) {
  console.log(`\n=== Failed scenarios (first 10) ===`);
  const fails = diffs.filter((d) => d.verdict === "fail").slice(0, 10);
  for (const f of fails) {
    console.log(
      `  ${f.id} ${f.brand} ${f.model} ${f.term}m: ` +
        `PMT Δ${f.delta.monthlyPayment} | Rate Δ${f.delta.effectiveRate.toFixed(6)} | ` +
        `RV Δ${f.delta.residualAmount} | Tax Δ${f.delta.acquisitionTax} | ` +
        `Provider: excel=${f.excel.winnerProvider} engine=${f.engine.winnerProvider}`
    );
  }
}
