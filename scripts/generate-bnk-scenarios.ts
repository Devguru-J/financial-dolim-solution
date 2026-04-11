import { readFileSync, writeFileSync } from "node:fs";

import { parseBnkWorkbook } from "@/domain/lenders/bnk-capital/workbook-parser";

type GeneratorOptions = {
  workbook: string;
  output: string;
  limit: number;
  term: 12 | 24 | 36 | 48 | 60;
  residualMode: "standard" | "high";
  vehiclePrice: number;
  sample: "first" | "diverse";
};

type Scenario = {
  id: string;
  brand: string;
  model: string;
  term: number;
  annualMileageKm: number;
  vehiclePrice: number;
  dealerName: string | null;
  residualMode: "standard" | "high";
  importCategory?: "수입" | "국산";
};

function parseCli(argv: string[]): GeneratorOptions {
  const opts: GeneratorOptions = {
    workbook:
      "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm",
    output: "",
    limit: 0,
    term: 60,
    residualMode: "high",
    vehiclePrice: 50000000,
    sample: "diverse",
  };
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    if (!k || v == null) continue;
    if (k === "workbook") opts.workbook = v;
    else if (k === "output") opts.output = v;
    else if (k === "limit") opts.limit = Number(v);
    else if (k === "term") opts.term = Number(v) as GeneratorOptions["term"];
    else if (k === "residualMode")
      opts.residualMode = v === "high" ? "high" : "standard";
    else if (k === "vehiclePrice") opts.vehiclePrice = Number(v);
    else if (k === "sample")
      opts.sample = v === "first" ? "first" : "diverse";
  }
  if (!opts.output) throw new Error("--output=path.json required");
  return opts;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replaceAll(/[^a-z0-9가-힣]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 80);
}

function buildDealerMap(
  policies: Array<{
    brand: string;
    ownershipType: string;
    baseIrrRate: string | number;
    dealerName?: string;
  }>,
): Map<string, string | null> {
  // For each brand, find the 비제휴 dealer entry (ownership=company). If none
  // exists, fall back to the brand-level policy (no dealerName). The chosen
  // string is exactly what needs to land in Es1!B156 so VLOOKUP against
  // Cond!D4:G64 hits the right row.
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

// Filter vehicles that have at least one residual grade — others won't work in Excel
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
console.error(`[bnk-gen] ${usable.length} vehicles have at least one residual grade`);

let picked = usable;
if (opts.sample === "diverse") {
  // Group by brand and round-robin pick so that we hit many brands early.
  const byBrand = new Map<string, typeof usable>();
  for (const v of usable) {
    const arr = byBrand.get(v.brand) ?? [];
    arr.push(v);
    byBrand.set(v.brand, arr);
  }
  const brands = [...byBrand.keys()].sort();
  const queues = brands.map((b) => [...(byBrand.get(b) ?? [])]);
  const out: typeof usable = [];
  while (out.length < usable.length && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const v = q.shift();
      if (v) out.push(v);
      if (opts.limit > 0 && out.length >= opts.limit) break;
    }
    if (opts.limit > 0 && out.length >= opts.limit) break;
  }
  picked = out;
}

if (opts.limit > 0) {
  picked = picked.slice(0, opts.limit);
}

const dealerMap = buildDealerMap(
  parsed.brandRatePolicies as unknown as Parameters<typeof buildDealerMap>[0],
);
console.error(
  `[bnk-gen] dealer map: ${[...dealerMap.entries()].map(([b, d]) => `${b}=${d ?? "(none)"}`).join(", ")}`,
);

// BNK cross-brand alias: parser splits "포드/링컨" into FORD/LINCOLN, but the
// original Cond policies may only resolve under "포드/링컨". Same with some
// other merged entries.
function resolveDealer(brand: string): string | null {
  const direct = dealerMap.get(brand);
  if (direct !== undefined) return direct;
  if (brand === "FORD" || brand === "LINCOLN") return dealerMap.get("포드/링컨") ?? null;
  return null;
}

// Drop vehicles whose brand has no 비제휴 policy — Excel VLOOKUP would fail on
// B166 and cascade every downstream cell to missing value.
const withDealer = picked
  .map((v) => ({ v, dealer: resolveDealer(v.brand) }))
  .filter((x) => x.dealer != null);
const droppedBrands = new Set(
  picked.map((v) => v.brand).filter((b) => resolveDealer(b) == null),
);
if (droppedBrands.size > 0) {
  console.error(
    `[bnk-gen] dropped ${picked.length - withDealer.length} vehicles from brands without 비제휴 dealer policy: ${[...droppedBrands].join(", ")}`,
  );
}

const scenarios: Scenario[] = withDealer.map(({ v, dealer }, idx) => ({
  id: `${String(idx).padStart(5, "0")}-${slugify(v.brand)}-${slugify(v.modelName)}-${opts.term}m`,
  brand: v.brand,
  model: v.modelName,
  term: opts.term,
  annualMileageKm: 20000,
  vehiclePrice: opts.vehiclePrice,
  dealerName: dealer,
  residualMode: opts.residualMode,
}));

writeFileSync(opts.output, JSON.stringify(scenarios, null, 2));
console.error(
  `[bnk-gen] wrote ${scenarios.length} scenarios (term=${opts.term}, residual=${opts.residualMode}, sample=${opts.sample}) → ${opts.output}`,
);
