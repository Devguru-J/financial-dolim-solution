import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import { calculateBnkOperatingLeaseQuoteFromContext } from "@/domain/lenders/bnk-capital/operating-lease-service";

type BnkOperatingLeaseFixture = {
  name: string;
  workbookVersion: string;
  workbookDebug?: {
    selectedResidualRatio?: number;
    residualGuaranteeCompany?: string;
    guaranteeBaseRatio?: number;
  };
  vehicle?: {
    brand?: string;
    modelName?: string;
    vehicleClass: string | null;
    engineDisplacementCc: number | null;
    highResidualAllowed: boolean | null;
    hybridAllowed: boolean | null;
    rawRow?: Record<string, unknown>;
  };
  /** Provider rates for Phase B auto-rate fixtures */
  providerRates?: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[];
  /** Base IRR from brand policy — used in Phase B fixtures */
  policyBaseIrr?: number;
  input: {
    lenderCode: "bnk-capital";
    productType: "operating_lease";
    brand: string;
    modelName: string;
    ownershipType: "company" | "customer";
    leaseTermMonths: 12 | 24 | 36 | 48 | 60;
    upfrontPayment: number;
    depositAmount?: number;
    quotedVehiclePrice?: number;
    discountAmount?: number;
    annualIrrRateOverride?: number;
    residualAmountOverride?: number;
    selectedResidualRateOverride?: number;
    residualValueRatio?: number;
    acquisitionTaxRateOverride?: number;
    stampDuty?: number;
    cmFeeRate?: number;
    agFeeRate?: number;
  };
  expected: {
    discountedVehiclePrice: number;
    acquisitionTax: number;
    stampDuty: number;
    financedPrincipal: number;
    residualAmount: number;
    displayedAnnualRateDecimal: number;
    effectiveAnnualRateDecimal: number;
    monthlyPayment: number;
  };
  tolerance: {
    monthlyPayment: number;
    residualAmount: number;
    acquisitionTax: number;
    displayedAnnualRateDecimal?: number;
    effectiveAnnualRateDecimal?: number;
  };
};

function loadFixture(path: string): BnkOperatingLeaseFixture {
  return JSON.parse(readFileSync(path, "utf8")) as BnkOperatingLeaseFixture;
}

function assertWithinTolerance(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: expected ${expected}, got ${actual}`).toBeLessThanOrEqual(tolerance);
}

const fixtureDir =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/fixtures/bnk-capital/operating-lease";

for (const fileName of readdirSync(fixtureDir).filter((entry) => entry.endsWith(".json")).sort()) {
  test(`BNK operating lease fixture matches workbook: ${fileName}`, () => {
    const fixture = loadFixture(`${fixtureDir}/${fileName}`);

    const quote = calculateBnkOperatingLeaseQuoteFromContext({
      workbookImport: {
        id: "fixture-workbook-import",
        versionLabel: fixture.workbookVersion,
      },
      input: fixture.input,
      vehicle: {
        brand: fixture.vehicle?.brand ?? fixture.input.brand,
        modelName: fixture.vehicle?.modelName ?? fixture.input.modelName,
        vehicleClass: fixture.vehicle?.vehicleClass ?? "승용",
        engineDisplacementCc: fixture.vehicle?.engineDisplacementCc ?? 1998,
        highResidualAllowed: fixture.vehicle?.highResidualAllowed ?? false,
        hybridAllowed: fixture.vehicle?.hybridAllowed ?? false,
        rawRow: fixture.vehicle?.rawRow ?? null,
      },
      policyBaseIrr: fixture.policyBaseIrr ?? 0.0521,
      providerRates: fixture.providerRates ?? [],
    });

    expect(quote.workbookImport.versionLabel).toBe(fixture.workbookVersion);
    expect(quote.majorInputs.discountedVehiclePrice).toBe(fixture.expected.discountedVehiclePrice);
    expect(quote.majorInputs.financedPrincipal).toBe(fixture.expected.financedPrincipal);
    assertWithinTolerance(
      quote.feesAndTaxes.acquisitionTax,
      fixture.expected.acquisitionTax,
      fixture.tolerance.acquisitionTax,
      "acquisitionTax",
    );
    expect(quote.feesAndTaxes.stampDuty).toBe(fixture.expected.stampDuty);
    assertWithinTolerance(
      quote.residual.amount,
      fixture.expected.residualAmount,
      fixture.tolerance.residualAmount,
      "residualAmount",
    );
    if ((fixture.tolerance.displayedAnnualRateDecimal ?? 0) > 0) {
      assertWithinTolerance(
        quote.rates.annualRateDecimal,
        fixture.expected.displayedAnnualRateDecimal,
        fixture.tolerance.displayedAnnualRateDecimal!,
        "displayedAnnualRateDecimal",
      );
    } else {
      expect(quote.rates.annualRateDecimal).toBe(fixture.expected.displayedAnnualRateDecimal);
    }
    if ((fixture.tolerance.effectiveAnnualRateDecimal ?? 0) > 0) {
      assertWithinTolerance(
        quote.rates.effectiveAnnualRateDecimal,
        fixture.expected.effectiveAnnualRateDecimal,
        fixture.tolerance.effectiveAnnualRateDecimal!,
        "effectiveAnnualRateDecimal",
      );
    } else {
      expect(quote.rates.effectiveAnnualRateDecimal).toBe(fixture.expected.effectiveAnnualRateDecimal);
    }
    assertWithinTolerance(
      quote.monthlyPayment,
      fixture.expected.monthlyPayment,
      fixture.tolerance.monthlyPayment,
      "monthlyPayment",
    );
  });
}

// ---------------------------------------------------------------------------
// Helper for floating-point comparison (toBeCloseTo isn't in Bun's type shim)
// ---------------------------------------------------------------------------
function expectClose(actual: number, expected: number, epsilon = 1e-10) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
}

// ---------------------------------------------------------------------------
// B185 + C186 residual rate adjustment unit tests
// B185 = IF(company+gap>0, -0.3%, IF(customer+gap>0, +0.3%, 0%))
// C186 = IF(company+gap>0 + premium brand, +0.3%, 0%) — offsets B185
// Net: premium company gap>0 = 0, non-premium company gap>0 = -0.3%,
//      customer gap>0 = +0.3%, gap≤0 = 0
// ---------------------------------------------------------------------------

function buildB185Context(overrides: {
  brand: string;
  ownership: "company" | "customer";
  appliedRate: number;
  standardRate: number;
  policyBaseIrr: number;
}) {
  const { brand, ownership, appliedRate, standardRate, policyBaseIrr } = overrides;
  return {
    workbookImport: { id: "test", versionLabel: "test" },
    input: {
      lenderCode: "bnk-capital" as const,
      productType: "operating_lease" as const,
      brand,
      modelName: "Test Model",
      ownershipType: ownership,
      leaseTermMonths: 60 as const,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 100000000,
      discountAmount: 0,
      acquisitionTaxRateOverride: 0.07,
      selectedResidualRateOverride: appliedRate,
      cmFeeRate: 0,
      agFeeRate: 0,
    },
    vehicle: {
      brand,
      modelName: "Test Model",
      vehicleClass: "승용",
      engineDisplacementCc: 1998,
      highResidualAllowed: false,
      hybridAllowed: false,
      rawRow: { tyGrade: 3 } as Record<string, unknown>,
    },
    policyBaseIrr,
    providerRates: [
      { matrixGroup: "BNK_3", leaseTermMonths: 60, residualRate: String(standardRate) },
    ],
  };
}

test("B185: BMW company + applied > standard → premium offset, net 0%", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(
    buildB185Context({ brand: "BMW", ownership: "company", appliedRate: 0.55, standardRate: 0.52, policyBaseIrr: 0.05 }),
  );
  expectClose(q.rates.monthlyRateDecimal, 0.05 / 12);
});

test("B185: Volvo company + applied > standard → -0.3% adjustment", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(
    buildB185Context({ brand: "VOLVO", ownership: "company", appliedRate: 0.55, standardRate: 0.52, policyBaseIrr: 0.05 }),
  );
  expectClose(q.rates.monthlyRateDecimal, 0.047 / 12);
});

test("B185: BMW customer + applied > standard → +0.3% adjustment", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(
    buildB185Context({ brand: "BMW", ownership: "customer", appliedRate: 0.55, standardRate: 0.52, policyBaseIrr: 0.0591 }),
  );
  expectClose(q.rates.monthlyRateDecimal, 0.0621 / 12);
});

test("B185: Hyundai customer + applied > standard → +0.3% adjustment (non-premium customer)", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(
    buildB185Context({ brand: "HYUNDAI", ownership: "customer", appliedRate: 0.55, standardRate: 0.52, policyBaseIrr: 0.07 }),
  );
  expectClose(q.rates.monthlyRateDecimal, 0.073 / 12);
});

test("B185: BMW company + applied == standard → 0% (gap≤0)", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(
    buildB185Context({ brand: "BMW", ownership: "company", appliedRate: 0.52, standardRate: 0.52, policyBaseIrr: 0.05 }),
  );
  expectClose(q.rates.monthlyRateDecimal, 0.05 / 12);
});

test("B185: Volvo company + applied < standard → 0% (gap<0)", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(
    buildB185Context({ brand: "VOLVO", ownership: "company", appliedRate: 0.40, standardRate: 0.52, policyBaseIrr: 0.05 }),
  );
  expectClose(q.rates.monthlyRateDecimal, 0.05 / 12);
});

// ---------------------------------------------------------------------------
// C188 balloon surcharge unit tests
// (upfront + deposit) / vehiclePrice ∈ (40%, 50%] → +0.5%
// >50% → warning, surcharge 0
// ---------------------------------------------------------------------------

function buildBalloonContext(upfront: number, deposit: number) {
  return {
    workbookImport: { id: "test", versionLabel: "test" },
    input: {
      lenderCode: "bnk-capital" as const,
      productType: "operating_lease" as const,
      brand: "BMW",
      modelName: "Test",
      ownershipType: "company" as const,
      leaseTermMonths: 60 as const,
      upfrontPayment: upfront,
      depositAmount: deposit,
      quotedVehiclePrice: 100000000,
      discountAmount: 0,
      acquisitionTaxRateOverride: 0.07,
      selectedResidualRateOverride: 0.40,
      cmFeeRate: 0,
      agFeeRate: 0,
    },
    vehicle: {
      brand: "BMW",
      modelName: "Test",
      vehicleClass: "승용",
      engineDisplacementCc: 1998,
      highResidualAllowed: false,
      hybridAllowed: false,
      rawRow: { tyGrade: 3 } as Record<string, unknown>,
    },
    policyBaseIrr: 0.05,
    providerRates: [{ matrixGroup: "BNK_3", leaseTermMonths: 60, residualRate: "0.52" }],
  };
}

test("C188: balloon ratio 18% → 0% surcharge", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(buildBalloonContext(10000000, 8000000));
  expectClose(q.rates.monthlyRateDecimal, 0.05 / 12);
});

test("C188: balloon ratio 41% → +0.5% surcharge", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(buildBalloonContext(21000000, 20000000));
  expectClose(q.rates.monthlyRateDecimal, 0.055 / 12);
});

test("C188: balloon ratio exactly 40% → 0% (not in range)", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(buildBalloonContext(20000000, 20000000));
  expectClose(q.rates.monthlyRateDecimal, 0.05 / 12);
});

test("C188: balloon ratio exactly 50% → +0.5% surcharge (boundary)", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(buildBalloonContext(25000000, 25000000));
  expectClose(q.rates.monthlyRateDecimal, 0.055 / 12);
});

test("C188: balloon ratio 60% → warning, no surcharge applied", () => {
  const q = calculateBnkOperatingLeaseQuoteFromContext(buildBalloonContext(30000000, 30000000));
  expectClose(q.rates.monthlyRateDecimal, 0.05 / 12);
  expect(q.warnings.some((w) => w.includes("입력범위초과"))).toBe(true);
});
