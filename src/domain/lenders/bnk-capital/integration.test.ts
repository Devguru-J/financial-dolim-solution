import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { calculateBnkOperatingLeaseQuoteFromContext } from "@/domain/lenders/bnk-capital/operating-lease-service";
import { parseBnkWorkbook } from "@/domain/lenders/bnk-capital/workbook-parser";

// ---------------------------------------------------------------------------
// End-to-end integration tests — uses the REAL BNK workbook, parses it via the
// production parser, then runs quotes through the engine. Validates that the
// parser + engine together produce Excel-identical values for the production
// flow (which is what the site serves).
//
// Unlike the unit fixtures which use hand-curated providerRates and simplified
// rawRow, these tests exercise the full data path from .xlsm → quote result.
// ---------------------------------------------------------------------------

const WORKBOOK_PATH =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm";

const buf = readFileSync(WORKBOOK_PATH);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parsed = parseBnkWorkbook(ab as ArrayBuffer, {
  lenderCode: "bnk-capital",
  fileName: "bnk-workbook.xlsm",
});

function expectClose(actual: number, expected: number, epsilon: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
}

function findVehicle(brand: string, modelFragment: string) {
  const v = parsed.vehiclePrograms.find(
    (p) => p.brand === brand && p.modelName.includes(modelFragment),
  );
  if (!v) throw new Error(`Vehicle not found: ${brand} ${modelFragment}`);
  return v;
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

function dealerPolicy(brand: string, dealerFragment: string, ownership: "company" | "customer") {
  return parsed.brandRatePolicies.find(
    (p) =>
      p.brand === brand &&
      p.ownershipType === ownership &&
      (p as unknown as { dealerName?: string }).dealerName?.includes(dealerFragment),
  );
}

// ---------------------------------------------------------------------------
// BMW 520i — Excel Es1 reference values (captured 2026-04-11)
// Scenarios: 110M 60m, BMW-동성모터스, residualMode=high (JY 59.5%)
// ---------------------------------------------------------------------------

test("BNK integration: BMW 520i 60m 법인+고잔가 matches Excel (1,292,200 / 5.5964%)", () => {
  const bmw520 = findVehicle("BMW", "520i");
  const policy = dealerPolicy("BMW", "동성", "company");
  expect(policy != null).toBe(true);
  expectClose(Number(policy!.baseIrrRate), 0.0521, 1e-6);

  const result = calculateBnkOperatingLeaseQuoteFromContext({
    workbookImport: { id: "integration", versionLabel: parsed.detectedVersionLabel },
    // biome-ignore lint/suspicious/noExplicitAny: residualMode/bnkDealerName not in canonical type yet
    input: {
      lenderCode: "bnk-capital",
      productType: "operating_lease",
      brand: "BMW",
      modelName: bmw520.modelName,
      ownershipType: "company",
      leaseTermMonths: 60,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 110000000,
      discountAmount: 0,
      acquisitionTaxRateOverride: 0.07,
      residualMode: "high",
      cmFeeRate: 0,
      agFeeRate: 0,
      bnkDealerName: "BMW-동성모터스",
    } as any,
    vehicle: {
      brand: bmw520.brand,
      modelName: bmw520.modelName,
      vehicleClass: bmw520.vehicleClass,
      engineDisplacementCc: bmw520.engineDisplacementCc,
      highResidualAllowed: bmw520.highResidualAllowed,
      hybridAllowed: bmw520.hybridAllowed,
      rawRow: bmw520.rawRow as Record<string, unknown>,
    },
    policyBaseIrr: Number(policy!.baseIrrRate),
    providerRates: providerRatesFor(60),
  });

  // Engine must pick JY (grade 2.5) which gives highest boosted rate for BMW 520i
  expect(result.residual.matrixGroup).toBe("BNK_2.5");
  expectClose(result.residual.rateDecimal, 0.595, 1e-6);
  expect(result.residual.amount).toBe(65450000);
  expect(result.monthlyPayment).toBe(1292200);
  // B167 = 5.5964% (RATE back-calc). B185=-0.3% cancelled by C186 premium offset → net 0
  expectClose(result.rates.annualRateDecimal, 0.055964, 1e-5);
});

test("BNK integration: BMW 520i 60m 이용자+고잔가 matches Excel (1,371,400 / 6.6047%)", () => {
  const bmw520 = findVehicle("BMW", "520i");
  const policy = dealerPolicy("BMW", "동성", "customer");
  expect(policy != null).toBe(true);
  expectClose(Number(policy!.baseIrrRate), 0.0591, 1e-6);

  const result = calculateBnkOperatingLeaseQuoteFromContext({
    workbookImport: { id: "integration", versionLabel: parsed.detectedVersionLabel },
    // biome-ignore lint/suspicious/noExplicitAny: residualMode/bnkDealerName not in canonical type yet
    input: {
      lenderCode: "bnk-capital",
      productType: "operating_lease",
      brand: "BMW",
      modelName: bmw520.modelName,
      ownershipType: "customer",
      leaseTermMonths: 60,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 110000000,
      discountAmount: 0,
      acquisitionTaxRateOverride: 0.07,
      residualMode: "high",
      cmFeeRate: 0,
      agFeeRate: 0,
      bnkDealerName: "BMW-동성모터스",
    } as any,
    vehicle: {
      brand: bmw520.brand,
      modelName: bmw520.modelName,
      vehicleClass: bmw520.vehicleClass,
      engineDisplacementCc: bmw520.engineDisplacementCc,
      highResidualAllowed: bmw520.highResidualAllowed,
      hybridAllowed: bmw520.hybridAllowed,
      rawRow: bmw520.rawRow as Record<string, unknown>,
    },
    policyBaseIrr: Number(policy!.baseIrrRate),
    providerRates: providerRatesFor(60),
  });

  // Same provider (JY) picked via highest-rate selection in residualMode=high
  expect(result.residual.matrixGroup).toBe("BNK_2.5");
  expectClose(result.residual.rateDecimal, 0.595, 1e-6);
  expect(result.residual.amount).toBe(65450000);
  // B185=+0.3% applied (customer+gap>0, no C186 offset for customer) → composed rate 6.21%
  expect(result.monthlyPayment).toBe(1371400);
  // B167 = 6.6047% (RATE back-calc on clean PV + JY max fee 1.45% amortized)
  expectClose(result.rates.annualRateDecimal, 0.066047, 1e-5);
});

test("BNK integration: parser extracts BMW 520i jyGrade='2.5' (CDB col 18)", () => {
  const bmw520 = findVehicle("BMW", "520i");
  const rawRow = bmw520.rawRow as Record<string, unknown>;
  expect(rawRow.cbGrade).toBe(9);
  expect(rawRow.tyGrade).toBe(3);
  expect(rawRow.jyGrade).toBe("2.5");
  expect(rawRow.crGrade).toBe(6);
});

test("BNK integration: BNK_2.5 residual matrix present for 60m (=0.525)", () => {
  const row = parsed.residualMatrixRows.find(
    (r) => r.matrixGroup === "BNK_2.5" && r.leaseTermMonths === 60,
  );
  expect(row != null).toBe(true);
  expectClose(row!.residualRate, 0.525, 1e-6);
});

test("BNK integration: dealer policies include BMW-동성모터스 for both ownership types", () => {
  const company = dealerPolicy("BMW", "동성", "company");
  const customer = dealerPolicy("BMW", "동성", "customer");
  expect(company != null).toBe(true);
  expect(customer != null).toBe(true);
  expectClose(Number(company!.baseIrrRate), 0.0521, 1e-6);
  expectClose(Number(customer!.baseIrrRate), 0.0591, 1e-6);
});
