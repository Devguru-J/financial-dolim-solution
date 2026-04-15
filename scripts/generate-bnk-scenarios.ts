import { readFileSync, writeFileSync } from "node:fs";

import { parseBnkWorkbook } from "@/domain/lenders/bnk-capital/workbook-parser";

type Term = 12 | 24 | 36 | 48 | 60;
type ResidualMode = "standard" | "high";
type Ownership = "company" | "customer";

type GeneratorOptions = {
  workbook: string;
  output: string;
  vehiclesPerBrand: number; // 0 = no cap
  limit: number; // overall cap after axis expansion (0 = no cap)
  terms: Term[];
  residualModes: ResidualMode[];
  ownerships: Ownership[];
  vehiclePrice: number;
};

type Scenario = {
  id: string;
  brand: string;
  model: string;
  term: Term;
  annualMileageKm: number;
  vehiclePrice: number;
  dealerName: string | null;
  residualMode: ResidualMode;
  ownership: Ownership;
  importCategory?: "수입" | "국산";
};

function parseList<T extends string | number>(
  raw: string,
  coerce: (s: string) => T,
): T[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(coerce);
}

function parseCli(argv: string[]): GeneratorOptions {
  const opts: GeneratorOptions = {
    workbook:
      "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm",
    output: "",
    vehiclesPerBrand: 2,
    limit: 0,
    terms: [12, 24, 36, 48, 60],
    residualModes: ["standard", "high"],
    ownerships: ["company"],
    vehiclePrice: 50000000,
  };
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    if (!k || v == null) continue;
    if (k === "workbook") opts.workbook = v;
    else if (k === "output") opts.output = v;
    else if (k === "vehiclesPerBrand") opts.vehiclesPerBrand = Number(v);
    else if (k === "limit") opts.limit = Number(v);
    else if (k === "terms")
      opts.terms = parseList(v, (s) => Number(s) as Term);
    else if (k === "residualModes")
      opts.residualModes = parseList(v, (s) =>
        s === "high" ? ("high" as const) : ("standard" as const),
      );
    else if (k === "ownerships")
      opts.ownerships = parseList(v, (s) =>
        s === "customer" ? ("customer" as const) : ("company" as const),
      );
    else if (k === "vehiclePrice") opts.vehiclePrice = Number(v);
  }
  if (!opts.output) throw new Error("--output=path.json required");
  return opts;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replaceAll(/[^a-z0-9가-힣]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 60);
}

function buildDealerMap(
  policies: Array<{
    brand: string;
    ownershipType: string;
    baseIrrRate: string | number;
    dealerName?: string;
  }>,
): Map<string, string | null> {
  const byBrand = new Map<string, string | null>();
  for (const p of policies) {
    if (p.ownershipType !== "company") continue;
    const dealer = p.dealerName ?? null;
    const existing = byBrand.get(p.brand);
    if (dealer != null && dealer.includes("비제휴")) {
      byBrand.set(p.brand, dealer);
      continue;
    }
    if (existing === undefined) byBrand.set(p.brand, dealer);
  }
  return byBrand;
}

const opts = parseCli(process.argv.slice(2));

console.error(`[bnk-gen] parsing ${opts.workbook}...`);
const buf = readFileSync(opts.workbook);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parsed = parseBnkWorkbook(ab as ArrayBuffer, {
  lenderCode: "bnk-capital",
  fileName: "bnk-workbook.xlsm",
});
console.error(`[bnk-gen] ${parsed.vehiclePrograms.length} vehicles parsed`);

const usable = parsed.vehiclePrograms.filter((v) => {
  const raw = v.rawRow as Record<string, unknown>;
  return (
    raw.cbGrade != null ||
    raw.tyGrade != null ||
    raw.jyGrade != null ||
    raw.crGrade != null ||
    raw.adbGrade != null ||
    raw.wsGrade != null
  );
});
console.error(`[bnk-gen] ${usable.length} vehicles with a residual grade`);

const dealerMap = buildDealerMap(
  parsed.brandRatePolicies as unknown as Parameters<typeof buildDealerMap>[0],
);

function resolveDealer(brand: string): string | null {
  const direct = dealerMap.get(brand);
  if (direct !== undefined) return direct;
  if (brand === "FORD" || brand === "LINCOLN")
    return dealerMap.get("포드/링컨") ?? null;
  return null;
}

// Group by brand and pick N vehicles per brand (prefer latest modelYear).
const byBrand = new Map<string, typeof usable>();
for (const v of usable) {
  if (resolveDealer(v.brand) == null) continue; // skip brands without dealer
  const arr = byBrand.get(v.brand) ?? [];
  arr.push(v);
  byBrand.set(v.brand, arr);
}

const pickedVehicles: Array<{ v: (typeof usable)[number]; dealer: string }> = [];
for (const [brand, arr] of [...byBrand.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const dealer = resolveDealer(brand)!;
  const sorted = [...arr].sort((a, b) => {
    const ya = ((a.rawRow as Record<string, unknown>).modelYear as number) ?? 0;
    const yb = ((b.rawRow as Record<string, unknown>).modelYear as number) ?? 0;
    return yb - ya;
  });
  const take = opts.vehiclesPerBrand > 0 ? sorted.slice(0, opts.vehiclesPerBrand) : sorted;
  for (const v of take) pickedVehicles.push({ v, dealer });
}

console.error(
  `[bnk-gen] picked ${pickedVehicles.length} vehicles across ${byBrand.size} brands (${opts.vehiclesPerBrand}/brand)`,
);

// Multiply across axes
const scenarios: Scenario[] = [];
let idx = 0;
for (const { v, dealer } of pickedVehicles) {
  for (const term of opts.terms) {
    for (const residualMode of opts.residualModes) {
      for (const ownership of opts.ownerships) {
        scenarios.push({
          id: `${String(idx).padStart(5, "0")}-${slugify(v.brand)}-${slugify(v.modelName)}-${term}m-${residualMode}-${ownership}`,
          brand: v.brand,
          model: v.modelName,
          term,
          annualMileageKm: 20000,
          vehiclePrice: opts.vehiclePrice,
          dealerName: dealer,
          residualMode,
          ownership,
        });
        idx += 1;
      }
    }
  }
}

let output = scenarios;
if (opts.limit > 0 && output.length > opts.limit) output = output.slice(0, opts.limit);

writeFileSync(opts.output, JSON.stringify(output, null, 2));
console.error(
  `[bnk-gen] wrote ${output.length} scenarios (terms=${opts.terms.join(",")}, residual=${opts.residualModes.join(",")}, ownership=${opts.ownerships.join(",")}) → ${opts.output}`,
);
