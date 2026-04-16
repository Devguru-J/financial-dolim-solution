#!/usr/bin/env bun
/**
 * run-woori-sweep.ts
 *
 * Batch AppleScript runner for Woori Card Excel parity testing.
 * Opens the workbook, writes scenario inputs → reads outputs for each scenario.
 *
 * Usage:
 *   bun run scripts/run-woori-sweep.ts \
 *     --scenarios=woori-scenarios.json \
 *     --output=woori-sweep.json \
 *     --chunkSize=15
 *
 * Prerequisites:
 *   - Excel must be open with the Woori workbook (1.운용리스(비교) sheet visible)
 *   - macOS with AppleScript support
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";

type Scenario = {
  id: string;
  brand: string;
  model: string;
  term: number;
  annualMileageKm: number;
  vehiclePrice: number;
  residualMode: "standard" | "high";
  ownership: "company" | "customer";
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
  error?: string;
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
    output: args.output ?? "woori-sweep.json",
    chunkSize: Number(args.chunkSize ?? 15),
    delay: Number(args.delay ?? 1),
    startFrom: Number(args.startFrom ?? 0),
  };
}

// ---------------------------------------------------------------------------
// AppleScript builder
// ---------------------------------------------------------------------------

const WORKBOOK_NAME = "260310_수입차리스_오토핸즈잔가군수정_잠금해제.xlsx";
const SHEET_NAME = "1.운용리스(비교)";

/**
 * Build AppleScript lines to:
 * 1. Write scenario inputs to the workbook
 * 2. Trigger recalculation
 * 3. Read output cells
 */
function buildAppleScript(scenarios: Scenario[], delay: number): string[] {
  const lines: string[] = [
    'tell application "Microsoft Excel"',
    `  set wb to workbook "${WORKBOOK_NAME}"`,
    `  set ws to worksheet "${SHEET_NAME}" of wb`,
    `  set allResults to ""`,
    "",
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const sep = "|";

    // --- Write inputs ---
    // BA7: Brand
    lines.push(`  set value of range "BA7" of ws to "${s.brand}"`);
    // BA8: Model
    lines.push(`  set value of range "BA8" of ws to "${s.model}"`);
    // BA13: Base price (user input)
    lines.push(`  set value of range "BA13" of ws to ${s.vehiclePrice}`);
    // BA14: Option price = 0
    lines.push(`  set value of range "BA14" of ws to 0`);
    // BA15: Discount = 0
    lines.push(`  set value of range "BA15" of ws to 0`);
    // BA16: Delivery fee = 0
    lines.push(`  set value of range "BA16" of ws to 0`);

    // BQ17: ownership (false=금융사명의, true=이용자명의)
    const ownerVal = s.ownership === "customer" ? "true" : "false";
    lines.push(`  set value of range "BQ17" of ws to ${ownerVal}`);

    // AV34: RV level
    const rvLevel = s.residualMode === "high" ? "고잔가" : "일반잔가";
    lines.push(`  set value of range "AV34" of ws to "${rvLevel}"`);

    // AV31: Deposit mode = 차량가비율
    lines.push(`  set value of range "AV31" of ws to "차량가비율"`);
    // AV33: Residual mode = 차량가비율
    lines.push(`  set value of range "AV33" of ws to "차량가비율"`);

    // BA27: Term (조건①)
    lines.push(`  set value of range "BA27" of ws to ${s.term}`);
    // BA28: Mileage (조건①)
    lines.push(`  set value of range "BA28" of ws to ${s.annualMileageKm}`);

    // BA29: Upfront = 0
    lines.push(`  set value of range "BA29" of ws to 0`);
    // BA30: Deposit (금액) = 0
    lines.push(`  set value of range "BA30" of ws to 0`);
    // BA31: Deposit (비율) = 0
    lines.push(`  set value of range "BA31" of ws to 0`);

    // BA37: 삼일 잔가조정 = 0
    lines.push(`  set value of range "BA37" of ws to 0`);
    // BA38: 자동차세 = 미포함
    lines.push(`  set value of range "BA38" of ws to "미포함"`);
    // BA39: CM rate = 0
    lines.push(`  set value of range "BA39" of ws to 0`);

    // Pass 1: Calculate to get max residual rate (BW36)
    lines.push(`  calculate`);
    lines.push(`  delay ${delay}`);

    // Read the auto-selected max rate and set it as the user's chosen rate
    lines.push(`  set maxRate to (value of range "BW36" of ws)`);
    lines.push(`  set value of range "BA33" of ws to maxRate`);

    // Pass 2: Recalculate with the max rate applied
    lines.push(`  calculate`);
    lines.push(`  delay ${delay}`);

    // --- Read outputs (조건①) ---
    // Format: id|pmt|rate|baseIrr|residualAmt|residualRate|acqTax|acqCost|fee|winner|vehPrice
    lines.push(`  set pmt to (value of range "BW95" of ws)`);
    lines.push(`  set erate to (value of range "BW98" of ws)`);
    lines.push(`  set birr to (value of range "BW93" of ws)`);
    lines.push(`  set ramt to (value of range "BW46" of ws)`);
    lines.push(`  set rrate to (value of range "BW36" of ws)`);
    lines.push(`  set atax to (value of range "BS10" of ws)`);
    lines.push(`  set acost to (value of range "BW10" of ws)`);
    lines.push(`  set gfee to (value of range "BW62" of ws)`);
    lines.push(`  set winner to (value of range "BW130" of ws)`);
    lines.push(`  set vprice to (value of range "BS11" of ws)`);
    lines.push(
      `  set allResults to allResults & "${s.id}${sep}" & pmt & "${sep}" & erate & "${sep}" & birr & "${sep}" & ramt & "${sep}" & rrate & "${sep}" & atax & "${sep}" & acost & "${sep}" & gfee & "${sep}" & winner & "${sep}" & vprice & linefeed`
    );
    lines.push("");
  }

  lines.push("  return allResults");
  lines.push("end tell");
  return lines;
}

function runAppleScript(lines: string[]): string {
  const args = lines.flatMap((line) => ["-e", line]);
  try {
    const result = execFileSync("osascript", args, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600_000, // 10 min
    });
    return result;
  } catch (e: any) {
    // On error, check both stdout and stderr
    return (e.stdout ?? "") + "\n" + (e.stderr ?? "");
  }
}

function parseSweepOutput(raw: string): SweepResult[] {
  const results: SweepResult[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("|")) continue;

    const parts = trimmed.split("|").map((s) => s.trim());
    if (parts.length < 11) continue;

    const [id, pmt, erate, birr, ramt, rrate, atax, acost, gfee, winner, vprice] = parts;

    results.push({
      id,
      monthlyPayment: Math.round(Number(pmt)),
      effectiveAnnualRate: Number(erate),
      baseIrr: Number(birr),
      residualAmount: Math.round(Number(ramt)),
      residualRate: Number(rrate),
      acquisitionTax: Math.round(Number(atax)),
      acquisitionCost: Math.round(Number(acost)),
      guaranteeFee: Math.round(Number(gfee)),
      winnerProvider: String(winner),
      vehiclePrice: Math.round(Number(vprice)),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs();

const scenarios: Scenario[] = JSON.parse(readFileSync(opts.scenarios, "utf8"));
console.log(`Loaded ${scenarios.length} scenarios from ${opts.scenarios}`);

// Load checkpoint if exists
const partialPath = `${opts.output}.partial.json`;
let allResults: SweepResult[] = [];
let startIdx = opts.startFrom;

if (existsSync(partialPath) && startIdx === 0) {
  allResults = JSON.parse(readFileSync(partialPath, "utf8"));
  startIdx = allResults.length;
  console.log(`Resuming from checkpoint: ${startIdx} results already done`);
}

const remaining = scenarios.slice(startIdx);
const chunks: Scenario[][] = [];
for (let i = 0; i < remaining.length; i += opts.chunkSize) {
  chunks.push(remaining.slice(i, i + opts.chunkSize));
}

console.log(`Processing ${remaining.length} scenarios in ${chunks.length} chunks (size ${opts.chunkSize})\n`);

for (let ci = 0; ci < chunks.length; ci++) {
  const chunk = chunks[ci];
  const chunkStart = startIdx + ci * opts.chunkSize;
  console.log(
    `Chunk ${ci + 1}/${chunks.length} (scenarios ${chunkStart + 1}-${chunkStart + chunk.length})...`
  );

  const lines = buildAppleScript(chunk, opts.delay);
  const raw = runAppleScript(lines);
  const results = parseSweepOutput(raw);

  console.log(`  → Got ${results.length}/${chunk.length} results`);

  if (results.length !== chunk.length) {
    console.log(`  ⚠ Missing results. Raw output snippet:`);
    console.log(`  ${raw.substring(0, 500)}`);
  }

  allResults.push(...results);

  // Save checkpoint
  writeFileSync(partialPath, JSON.stringify(allResults, null, 2));
  console.log(`  Checkpoint saved: ${allResults.length} total`);
}

// Write final results
writeFileSync(opts.output, JSON.stringify(allResults, null, 2));
console.log(`\n✅ Sweep complete: ${allResults.length}/${scenarios.length} → ${opts.output}`);

// Clean up partial
if (existsSync(partialPath)) {
  const { unlinkSync } = require("fs");
  unlinkSync(partialPath);
}
