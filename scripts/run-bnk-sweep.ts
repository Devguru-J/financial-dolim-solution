import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import * as XLSX from "xlsx";

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
  irrAdjustment?: number; // delta added to base rate (운용리스견적!U45)
  residualMode?: "standard" | "high";
  dealerName?: string | null;
  importCategory?: "수입" | "국산";
  residualOverrideMode?: "auto" | "amount" | "ratio";
  residualOverrideValue?: number;
};

type ScenarioResult = {
  id: string;
  ok: boolean;
  error?: string;
  vehicle?: {
    brand: string;
    modelName: string;
    lookupName: string;
    modelYear: number | null;
    vehicleClass: string | null;
    engineDisplacementCc: number | null;
  };
  excel?: {
    displayedAnnualRateDecimal: number;
    effectiveAnnualRateDecimal: number;
    monthlyPayment: number;
    discountedVehiclePrice: number;
    acquisitionTax: number;
    residualAmount: number;
    acquisitionCost: number;
    termMonths: number;
  };
};

// name!G2:G6 = [60, 48, 36, 24, 12]; Es1!B40 = INDEX(name!G2:G6, B39)
const TERM_INDEX: Record<number, number> = { 60: 1, 48: 2, 36: 3, 24: 4, 12: 5 };
const MILEAGE_INDEX: Record<number, number> = {
  10000: 1,
  15000: 2,
  20000: 3,
  30000: 4,
  40000: 5,
};

const DEFAULT_WORKBOOK =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm";

function parseCli(argv: string[]): {
  workbook: string;
  scenariosPath: string;
  outputPath: string;
} {
  let workbook = DEFAULT_WORKBOOK;
  let scenariosPath = "";
  let outputPath = "";

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [k, v] = arg.slice(2).split("=");
    if (!k || v == null) continue;
    if (k === "workbook") workbook = v;
    else if (k === "scenarios") scenariosPath = v;
    else if (k === "output") outputPath = v;
  }

  if (!scenariosPath) throw new Error("--scenarios=path/to/scenarios.json is required");
  if (!outputPath) throw new Error("--output=path/to/results.json is required");

  return { workbook, scenariosPath, outputPath };
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replaceAll(",", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type VehicleLookup = {
  lookupName: string;
  modelYear: number | null;
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
};

function buildVehicleIndex(workbookPath: string): Map<string, VehicleLookup> {
  const wb = XLSX.readFile(workbookPath, { cellFormula: false });
  const sheet = wb.Sheets["CDB"];
  if (!sheet) throw new Error("CDB sheet not found");
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  }) as unknown[][];

  // Key by model name only — B17 VLOOKUP into CDB col J only uses the model
  // string (+ year suffix). Brand is used for index hashing only, which creates
  // problems when scenarios use parser-normalized brands like "FORD"/"LINCOLN"
  // while CDB stores them under "포드/링컨". Indexing by model alone sidesteps
  // the issue (model names are unique enough within this workbook).
  const map = new Map<string, VehicleLookup>();
  const bestYear = new Map<string, number>();

  for (const row of rows.slice(3)) {
    const brand = asText(row[4]);
    const model = asText(row[6]);
    if (!brand || !model) continue;
    const year = asNumber(row[7]) ?? 0;
    const key = model;
    if ((bestYear.get(key) ?? -Infinity) > year) continue;
    bestYear.set(key, year);
    map.set(key, {
      lookupName: year > 0 ? `${model} ${year}년형` : model,
      modelYear: asNumber(row[7]),
      vehicleClass: asText(row[12]),
      engineDisplacementCc: asNumber(row[13]),
    });
  }

  return map;
}

function escapeApplescriptString(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildScenarioBlock(
  s: Scenario,
  lookupName: string,
  sceneIdx: number,
): string {
  const ownership = s.ownership ?? "company";
  const term = s.term ?? 60;
  const mileage = s.annualMileageKm ?? 20000;
  const termIdx = TERM_INDEX[term];
  const mileageIdx = MILEAGE_INDEX[mileage];
  if (!termIdx || !mileageIdx) {
    throw new Error(`[${s.id}] invalid term/mileage: ${term}/${mileage}`);
  }
  const ownershipCode = ownership === "company" ? 1 : 2;
  const depositModeFlag = (s.depositAmount ?? 0) > 0 ? "true" : "false";
  const upfrontModeFlag = (s.upfrontPayment ?? 0) > 0 ? "true" : "false";
  const highRvFlag = s.residualMode === "high" ? "true" : "false";
  const importCode = s.importCategory === "국산" ? 2 : 1;
  const escapedModel = escapeApplescriptString(lookupName);

  const residualOverrideActive = s.residualOverrideMode && s.residualOverrideMode !== "auto";
  const residualModeFlag = residualOverrideActive ? "true" : "false";
  // G70="%", G71="금액". code 1 = ratio, code 2 = amount.
  const residualModeCode =
    s.residualOverrideMode === "ratio" ? 1 : s.residualOverrideMode === "amount" ? 2 : 2;
  const residualN34 = residualOverrideActive
    ? s.residualOverrideMode === "ratio"
      ? (s.residualOverrideValue ?? 0) * 100
      : (s.residualOverrideValue ?? 0)
    : 0;

  const dealerWrite = s.dealerName
    ? `set value of range "B156" of ws_es1 to "${escapeApplescriptString(s.dealerName)}"`
    : "-- no dealer override";

  return [
    `-- Scenario #${sceneIdx}: ${s.id}`,
    `set value of range "N5" of ws_bnk to ${importCode}`,
    `set value of range "N13" of ws_bnk to ${s.vehiclePrice}`,
    `set value of range "N15" of ws_bnk to ${s.discountAmount ?? 0}`,
    `set value of range "N34" of ws_bnk to ${residualN34}`,
    `set value of range "N37" of ws_bnk to ${s.depositAmount ?? 0}`,
    `set value of range "N39" of ws_bnk to ${s.upfrontPayment ?? 0}`,
    `set value of range "N41" of ws_bnk to ${s.agFeeRate ?? 0}`,
    `set value of range "N42" of ws_bnk to ${s.cmFeeRate ?? 0}`,
    `set value of range "U45" of ws_bnk to ${s.irrAdjustment ?? 0}`,
    `set value of range "B17" of ws_es1 to "${escapedModel}"`,
    `set value of range "B20" of ws_es1 to "${escapedModel}"`,
    `set value of range "B26" of ws_es1 to ${ownershipCode}`,
    `set value of range "B39" of ws_es1 to ${termIdx}`,
    `set value of range "B41" of ws_es1 to ${mileageIdx}`,
    `set value of range "B71" of ws_es1 to ${highRvFlag}`,
    `set value of range "B73" of ws_es1 to ${residualModeCode}`,
    `set value of range "B136" of ws_es1 to ${residualModeFlag}`,
    `set value of range "B137" of ws_es1 to ${depositModeFlag}`,
    `set value of range "B138" of ws_es1 to ${upfrontModeFlag}`,
    dealerWrite,
    "calculate",
    "delay 1",
    `set end of resultList to "${s.id}|" & ((value of range "B167" of ws_es1) as text) & "|" & ((value of range "B168" of ws_es1) as text) & "|" & ((value of range "B87" of ws_es1) as text) & "|" & ((value of range "B101" of ws_es1) as text) & "|" & ((value of range "B70" of ws_es1) as text) & "|" & ((value of range "B134" of ws_es1) as text) & "|" & ((value of range "B166" of ws_es1) as text) & "|" & ((value of range "B40" of ws_es1) as text)`,
  ].join("\n");
}

function runBatch(
  workbookPath: string,
  scenarios: Array<{ scenario: Scenario; lookupName: string }>,
): Map<string, string[]> {
  const tempDir = mkdtempSync(`${tmpdir()}/bnk-sweep-`);
  const tempWorkbookPath = `${tempDir}/bnk-sweep-${process.pid}-${Date.now()}.xlsm`;
  cpSync(workbookPath, tempWorkbookPath);
  const workbookName = basename(tempWorkbookPath);

  const scenarioBlocks = scenarios
    .map(({ scenario, lookupName }, i) => buildScenarioBlock(scenario, lookupName, i))
    .join("\n\n");

  const script = `
set workbookPath to POSIX file "${tempWorkbookPath}"
set resultList to {}
tell application "Microsoft Excel"
  activate
  open workbook workbook file name workbookPath
  delay 2
  set wb to workbook "${workbookName}"
  set ws_bnk to worksheet "운용리스견적" of wb
  set ws_es1 to worksheet "Es1" of wb

${scenarioBlocks}

  close wb saving no
end tell

set AppleScript's text item delimiters to linefeed
set joined to resultList as text
set AppleScript's text item delimiters to ""
return joined
`;

  const scriptPath = `${tempDir}/sweep.applescript`;
  writeFileSync(scriptPath, script);

  try {
    const raw = execFileSync("osascript", [scriptPath], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).trim();

    const lines = raw.split(/\r?\n/);
    const map = new Map<string, string[]>();
    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length < 2) continue;
      const id = parts[0];
      map.set(id, parts.slice(1));
    }
    return map;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const { workbook, scenariosPath, outputPath } = parseCli(process.argv.slice(2));
const scenarios: Scenario[] = JSON.parse(readFileSync(scenariosPath, "utf8"));
if (!Array.isArray(scenarios) || scenarios.length === 0) {
  throw new Error("scenarios file must be a non-empty JSON array");
}

console.error(`[bnk-sweep] building vehicle index from ${workbook}...`);
const vehicleIndex = buildVehicleIndex(workbook);
console.error(`[bnk-sweep] indexed ${vehicleIndex.size} vehicles`);

const resolved: Array<{ scenario: Scenario; lookupName: string; vehicle: VehicleLookup } | { scenario: Scenario; error: string }> = [];
for (const s of scenarios) {
  const v = vehicleIndex.get(s.model);
  if (!v) {
    resolved.push({ scenario: s, error: `vehicle not found: ${s.brand} / ${s.model}` });
  } else {
    resolved.push({ scenario: s, lookupName: v.lookupName, vehicle: v });
  }
}

const toRun = resolved.flatMap((r) =>
  "lookupName" in r ? [{ scenario: r.scenario, lookupName: r.lookupName }] : [],
);

console.error(`[bnk-sweep] running ${toRun.length} / ${scenarios.length} scenarios in one Excel session`);
const t0 = Date.now();
const rawMap = runBatch(workbook, toRun);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.error(`[bnk-sweep] Excel batch finished in ${elapsed}s`);

const results: ScenarioResult[] = resolved.map((r) => {
  if ("error" in r) {
    return { id: r.scenario.id, ok: false, error: r.error };
  }
  const values = rawMap.get(r.scenario.id);
  if (!values) {
    return { id: r.scenario.id, ok: false, error: "no result row from Excel" };
  }
  const [rate, pmt, disc, tax, residual, cost, baseIrr, term] = values;
  const parsed = {
    displayedAnnualRateDecimal: Number(rate),
    monthlyPayment: Number(pmt),
    discountedVehiclePrice: Number(disc),
    acquisitionTax: Number(tax),
    residualAmount: Number(residual),
    acquisitionCost: Number(cost),
    effectiveAnnualRateDecimal: Number(baseIrr),
    termMonths: Number(term),
  };
  const hasNaN = Object.values(parsed).some((n) => !Number.isFinite(n));
  return {
    id: r.scenario.id,
    ok: !hasNaN,
    error: hasNaN ? `missing value in output: ${values.join("|")}` : undefined,
    vehicle: {
      brand: r.scenario.brand,
      modelName: r.scenario.model,
      lookupName: r.lookupName,
      modelYear: r.vehicle.modelYear,
      vehicleClass: r.vehicle.vehicleClass,
      engineDisplacementCc: r.vehicle.engineDisplacementCc,
    },
    excel: parsed,
  };
});

writeFileSync(outputPath, JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok).length;
console.error(`[bnk-sweep] wrote ${results.length} results (${ok} ok, ${results.length - ok} failed) → ${outputPath}`);
