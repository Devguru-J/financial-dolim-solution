import { readFileSync, writeFileSync } from "node:fs";

import { calculateBnkOperatingLeaseQuoteFromContext } from "@/domain/lenders/bnk-capital/operating-lease-service";
import { parseBnkWorkbook } from "@/domain/lenders/bnk-capital/workbook-parser";

type Scenario = {
  id: string;
  brand: string;
  model: string;
  ownership?: "company" | "customer";
  term?: 12 | 24 | 36 | 48 | 60;
  annualMileageKm?: 10000 | 15000 | 20000 | 30000 | 40000;
  vehiclePrice: number;
  discountAmount?: number;
  upfrontPayment?: number;
  depositAmount?: number;
  cmFeeRate?: number;
  agFeeRate?: number;
  residualMode?: "standard" | "high";
  dealerName?: string | null;
  residualOverrideMode?: "auto" | "amount" | "ratio";
  residualOverrideValue?: number;
};

type ExcelResult = {
  displayedAnnualRateDecimal: number;
  effectiveAnnualRateDecimal: number;
  monthlyPayment: number;
  discountedVehiclePrice: number;
  acquisitionTax: number;
  residualAmount: number;
  acquisitionCost: number;
  termMonths: number;
};

type SweepResult = {
  id: string;
  ok: boolean;
  error?: string;
  excel?: ExcelResult;
};

type Tolerance = {
  monthlyPayment: number;
  displayedAnnualRate: number;
  residualAmount: number;
};

const DEFAULT_TOLERANCE: Tolerance = {
  monthlyPayment: 1,
  displayedAnnualRate: 1e-4,
  residualAmount: 1000, // Excel rounds residual to 1000원; engine may differ by rounding
};

function parseCli(argv: string[]): {
  workbook: string;
  scenarios: string;
  sweep: string;
  output: string;
} {
  let workbook = "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm";
  let scenarios = "";
  let sweep = "";
  let output = "";
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    if (!k || v == null) continue;
    if (k === "workbook") workbook = v;
    else if (k === "scenarios") scenarios = v;
    else if (k === "sweep") sweep = v;
    else if (k === "output") output = v;
  }
  if (!scenarios) throw new Error("--scenarios required");
  if (!sweep) throw new Error("--sweep required (output of run-bnk-sweep.ts)");
  if (!output) throw new Error("--output required");
  return { workbook, scenarios, sweep, output };
}

const { workbook, scenarios: scenariosPath, sweep: sweepPath, output: outputPath } = parseCli(
  process.argv.slice(2),
);

const scenarios: Scenario[] = JSON.parse(readFileSync(scenariosPath, "utf8"));
const sweep: SweepResult[] = JSON.parse(readFileSync(sweepPath, "utf8"));
const sweepById = new Map(sweep.map((r) => [r.id, r]));

console.error(`[bnk-diff] parsing workbook ${workbook}...`);
const buf = readFileSync(workbook);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parsed = parseBnkWorkbook(ab as ArrayBuffer, {
  lenderCode: "bnk-capital",
  fileName: "bnk-workbook.xlsm",
});
console.error(
  `[bnk-diff] parser: ${parsed.vehiclePrograms.length} vehicles, ${parsed.residualMatrixRows.length} residual rows, ${parsed.brandRatePolicies.length} dealer policies`,
);

function findVehicle(brand: string, modelName: string) {
  return parsed.vehiclePrograms.find(
    (p) => p.brand === brand && p.modelName === modelName,
  );
}

function providerRatesFor(termMonths: number) {
  return parsed.residualMatrixRows
    .filter((r) => r.leaseTermMonths === termMonths)
    .map((r) => ({
      matrixGroup: r.matrixGroup,
      leaseTermMonths: r.leaseTermMonths,
      residualRate: String(r.residualRate),
    }));
}

// Some parser outputs split merged CDB brands (e.g. FORD/LINCOLN) but the
// Cond policies still resolve under the original merged string.
const BRAND_ALIASES: Record<string, string[]> = {
  FORD: ["FORD", "포드/링컨", "포드"],
  LINCOLN: ["LINCOLN", "포드/링컨", "링컨"],
};

function findPolicy(brand: string, dealerName: string | null | undefined, ownership: "company" | "customer") {
  const target = dealerName ?? null;
  const brandCandidates = BRAND_ALIASES[brand] ?? [brand];
  return parsed.brandRatePolicies.find((p) => {
    if (!brandCandidates.includes(p.brand)) return false;
    if (p.ownershipType !== ownership) return false;
    const dn = (p as unknown as { dealerName?: string }).dealerName ?? null;
    if (target == null) return dn == null || dn.includes("비제휴");
    return dn === target || (dn != null && dn.includes(target));
  });
}

type DiffEntry = {
  id: string;
  status: "match" | "mismatch" | "engine-error" | "excel-error" | "vehicle-missing" | "policy-missing";
  diff?: {
    monthlyPayment: { excel: number; engine: number; delta: number };
    displayedAnnualRate: { excel: number; engine: number; delta: number };
    residualAmount: { excel: number; engine: number; delta: number };
  };
  engine?: {
    monthlyPayment: number;
    displayedAnnualRate: number;
    residualAmount: number;
    matrixGroup: string;
  };
  excel?: ExcelResult;
  error?: string;
};

const entries: DiffEntry[] = [];

for (const s of scenarios) {
  const excelResult = sweepById.get(s.id);
  if (!excelResult) {
    entries.push({ id: s.id, status: "excel-error", error: "not in sweep output" });
    continue;
  }
  if (!excelResult.ok || !excelResult.excel) {
    entries.push({ id: s.id, status: "excel-error", error: excelResult.error ?? "excel failed" });
    continue;
  }
  const vehicle = findVehicle(s.brand, s.model);
  if (!vehicle) {
    entries.push({ id: s.id, status: "vehicle-missing", error: `${s.brand} / ${s.model}` });
    continue;
  }
  const ownership = s.ownership ?? "company";
  const policy = findPolicy(s.brand, s.dealerName ?? null, ownership);
  if (!policy) {
    entries.push({
      id: s.id,
      status: "policy-missing",
      error: `${s.brand} / ${s.dealerName ?? "비제휴"} / ${ownership}`,
    });
    continue;
  }

  try {
    const engineInput: Record<string, unknown> = {
      lenderCode: "bnk-capital",
      productType: "operating_lease",
      brand: s.brand,
      modelName: s.model,
      ownershipType: ownership,
      leaseTermMonths: s.term ?? 60,
      upfrontPayment: s.upfrontPayment ?? 0,
      depositAmount: s.depositAmount ?? 0,
      quotedVehiclePrice: s.vehiclePrice,
      discountAmount: s.discountAmount ?? 0,
      // Let engine pick default per vehicle class (e.g. 화물 → 5%, 승용 ≥1600cc → 7%)
      residualMode: s.residualMode ?? "standard",
      cmFeeRate: s.cmFeeRate ?? 0,
      agFeeRate: s.agFeeRate ?? 0,
      bnkDealerName:
        (policy as unknown as { dealerName?: string }).dealerName ?? s.dealerName ?? undefined,
      annualMileageKm: s.annualMileageKm ?? 20000,
    };

    if (s.residualOverrideMode === "amount" && s.residualOverrideValue != null) {
      engineInput.residualValueMode = "amount";
      engineInput.residualAmountOverride = s.residualOverrideValue;
    } else if (s.residualOverrideMode === "ratio" && s.residualOverrideValue != null) {
      engineInput.residualValueMode = "ratio";
      engineInput.residualRatioOverride = s.residualOverrideValue;
    }

    const result = calculateBnkOperatingLeaseQuoteFromContext({
      workbookImport: { id: "diff", versionLabel: parsed.detectedVersionLabel },
      // biome-ignore lint/suspicious/noExplicitAny: canonical type wip
      input: engineInput as any,
      vehicle: {
        brand: vehicle.brand,
        modelName: vehicle.modelName,
        vehicleClass: vehicle.vehicleClass,
        engineDisplacementCc: vehicle.engineDisplacementCc,
        highResidualAllowed: vehicle.highResidualAllowed,
        hybridAllowed: vehicle.hybridAllowed,
        rawRow: vehicle.rawRow as Record<string, unknown>,
      },
      policyBaseIrr: Number(policy.baseIrrRate),
      providerRates: providerRatesFor(s.term ?? 60),
    });

    const enginePmt = result.monthlyPayment;
    const engineRate = result.rates.annualRateDecimal;
    const engineResidual = result.residual.amount;

    const excel = excelResult.excel;
    const pmtDelta = enginePmt - excel.monthlyPayment;
    const rateDelta = engineRate - excel.displayedAnnualRateDecimal;
    const residualDelta = engineResidual - excel.residualAmount;

    const within =
      Math.abs(pmtDelta) <= DEFAULT_TOLERANCE.monthlyPayment &&
      Math.abs(rateDelta) <= DEFAULT_TOLERANCE.displayedAnnualRate &&
      Math.abs(residualDelta) <= DEFAULT_TOLERANCE.residualAmount;

    entries.push({
      id: s.id,
      status: within ? "match" : "mismatch",
      diff: {
        monthlyPayment: { excel: excel.monthlyPayment, engine: enginePmt, delta: pmtDelta },
        displayedAnnualRate: {
          excel: excel.displayedAnnualRateDecimal,
          engine: engineRate,
          delta: rateDelta,
        },
        residualAmount: { excel: excel.residualAmount, engine: engineResidual, delta: residualDelta },
      },
      engine: {
        monthlyPayment: enginePmt,
        displayedAnnualRate: engineRate,
        residualAmount: engineResidual,
        matrixGroup: result.residual.matrixGroup,
      },
      excel,
    });
  } catch (e) {
    entries.push({
      id: s.id,
      status: "engine-error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

const summary = {
  total: entries.length,
  match: entries.filter((e) => e.status === "match").length,
  mismatch: entries.filter((e) => e.status === "mismatch").length,
  engineError: entries.filter((e) => e.status === "engine-error").length,
  excelError: entries.filter((e) => e.status === "excel-error").length,
  vehicleMissing: entries.filter((e) => e.status === "vehicle-missing").length,
  policyMissing: entries.filter((e) => e.status === "policy-missing").length,
};

writeFileSync(outputPath, JSON.stringify({ summary, tolerance: DEFAULT_TOLERANCE, entries }, null, 2));
console.error(`[bnk-diff] summary:`, JSON.stringify(summary));
console.error(`[bnk-diff] wrote ${entries.length} entries → ${outputPath}`);

const mismatches = entries.filter((e) => e.status === "mismatch");
if (mismatches.length > 0) {
  console.error(`[bnk-diff] ${mismatches.length} mismatches:`);
  for (const m of mismatches.slice(0, 10)) {
    console.error(
      `  ${m.id}: pmt Δ=${m.diff?.monthlyPayment.delta} rate Δ=${m.diff?.displayedAnnualRate.delta?.toFixed(6)} resid Δ=${m.diff?.residualAmount.delta}`,
    );
  }
  process.exit(1);
}
