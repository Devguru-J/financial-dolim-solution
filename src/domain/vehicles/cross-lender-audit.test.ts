import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { parseBnkWorkbook } from "@/domain/lenders/bnk-capital/workbook-parser";
import { parseMgWorkbook } from "@/domain/lenders/mg-capital/workbook-parser";
import { extractVehicleKey, resolveModelNameByVehicleKey } from "@/domain/vehicles/vehicle-key";

// ---------------------------------------------------------------------------
// Audit: parses real MG + BNK workbooks and verifies cross-lender matching
// coverage. Prevents regression on the Korean/English brand alias and the
// per-brand vehicleKey patterns (BMW M-performance, iX M60/M70, BENZ EQ
// series, etc.).
// ---------------------------------------------------------------------------

const MG_PATH =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제.xlsx";
const BNK_PATH =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm";

const mgBuf = readFileSync(MG_PATH);
const bnkBuf = readFileSync(BNK_PATH);
const mg = parseMgWorkbook(
  mgBuf.buffer.slice(mgBuf.byteOffset, mgBuf.byteOffset + mgBuf.byteLength) as ArrayBuffer,
  { lenderCode: "mg-capital", fileName: "mg.xlsx" },
);
const bnk = parseBnkWorkbook(
  bnkBuf.buffer.slice(bnkBuf.byteOffset, bnkBuf.byteOffset + bnkBuf.byteLength) as ArrayBuffer,
  { lenderCode: "bnk-capital", fileName: "bnk.xlsm" },
);

test("audit: MG→BNK cross-lender match rate ≥ 80%", () => {
  let matched = 0;
  for (const v of mg.vehiclePrograms) {
    if (resolveModelNameByVehicleKey(v.brand, v.modelName, bnk.vehiclePrograms)) {
      matched++;
    }
  }
  const rate = matched / mg.vehiclePrograms.length;
  expect(rate >= 0.8).toBe(true);
});

test("audit: BNK parser splits '포드/링컨' into separate FORD and LINCOLN brands", () => {
  const fordCount = bnk.vehiclePrograms.filter((v) => v.brand === "FORD").length;
  const lincolnCount = bnk.vehiclePrograms.filter((v) => v.brand === "LINCOLN").length;
  const combinedCount = bnk.vehiclePrograms.filter((v) => v.brand === "포드/링컨").length;
  expect(fordCount > 0).toBe(true);
  expect(lincolnCount > 0).toBe(true);
  expect(combinedCount).toBe(0);
});

test("audit: BMW M340i Sedan cross-lender match works", () => {
  const resolved = resolveModelNameByVehicleKey("BMW", "M340i Sedan", bnk.vehiclePrograms);
  expect(resolved != null).toBe(true);
  expect(resolved!.modelName.includes("M340i")).toBe(true);
});

test("audit: BMW iX M60 cross-lender match works", () => {
  const resolved = resolveModelNameByVehicleKey("BMW", "iX M60", bnk.vehiclePrograms);
  expect(resolved != null).toBe(true);
  expect(resolved!.modelName.includes("M60")).toBe(true);
});

test("audit: Audi brand alias (MG 'AUDI' ↔ BNK '아우디') works", () => {
  // MG uses English "AUDI", BNK uses Korean "아우디". Cross-match should still work.
  const audiMg = mg.vehiclePrograms.find((v) => v.brand === "AUDI" && v.modelName.includes("A7"));
  expect(audiMg != null).toBe(true);
  const resolved = resolveModelNameByVehicleKey("AUDI", audiMg!.modelName, bnk.vehiclePrograms);
  expect(resolved != null).toBe(true);
});

test("audit: BENZ EQA 250 extracts number despite BNK 'EQA 전기 EQA 250' duplication", () => {
  const key = extractVehicleKey("벤츠", "The New EQA 전기 EQA 250 AMG Line");
  expect(key).toBe("BENZ_EQA250");
});

test("audit: BENZ G63 AMG works with 2-digit G variant", () => {
  expect(extractVehicleKey("BENZ", "G 63 AMG")).toBe("BENZ_G63");
  expect(extractVehicleKey("벤츠", "The New G-Class 가솔린 4.0 AMG G63")).toBe("BENZ_G63");
});

test("audit: BENZ AMG GT 4door handles body style noise", () => {
  expect(extractVehicleKey("BENZ", "AMG GT 4door 43 4Matic+")).toBe("BENZ_GT43");
});

test("audit: BMW X1 sDrive18d (BNK single token) matches MG 'X1 18d'", () => {
  const mgKey = extractVehicleKey("BMW", "X1 18d xLine xDrive");
  const bnkKey = extractVehicleKey("BMW", "The New X1 디젤 2.0 sDrive18d M Sport Package");
  expect(mgKey).toBe(bnkKey);
  expect(mgKey).toBe("BMW_X1_18D");
});

test("audit: Porsche Cayenne Coupe S cross-lender parity", () => {
  const mgKey = extractVehicleKey("PORSCHE", "Cayenne Coupe S");
  const bnkKey = extractVehicleKey("포르쉐", "Cayenne Coupe 가솔린 3.0 V6 S");
  expect(mgKey).toBe(bnkKey);
});

test("audit: null-key vehicles are below 20 (pattern coverage)", () => {
  let nullCount = 0;
  for (const v of mg.vehiclePrograms) {
    if (!extractVehicleKey(v.brand, v.modelName)) nullCount++;
  }
  expect(nullCount).toBeLessThanOrEqual(20);
});
