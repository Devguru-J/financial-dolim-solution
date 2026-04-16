import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { calculateWooriOperatingLeaseQuoteFromContext } from "@/domain/lenders/woori-card/operating-lease-service";

type WooriOperatingLeaseFixture = {
  name: string;
  workbookVersion: string;
  vehicle?: {
    brand?: string;
    modelName?: string;
    vehicleClass: string | null;
    engineDisplacementCc: number | null;
    highResidualAllowed: boolean | null;
    hybridAllowed: boolean | null;
    rawRow?: Record<string, unknown>;
  };
  providerRates?: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[];
  policyBaseIrr?: number;
  input: {
    lenderCode: "woori-card";
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
    residualMode?: "high" | "standard";
    acquisitionTaxRateOverride?: number;
    stampDuty?: number;
    cmFeeRate?: number;
    agFeeRate?: number;
    annualMileageKm?: 10000 | 15000 | 20000 | 25000 | 30000 | 35000 | 40000;
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
    selectedProvider?: string | null;
    residualRate?: number;
  };
  tolerance: {
    monthlyPayment: number;
    residualAmount: number;
    acquisitionTax: number;
    displayedAnnualRateDecimal?: number;
    effectiveAnnualRateDecimal?: number;
  };
};

function loadFixture(path: string): WooriOperatingLeaseFixture {
  return JSON.parse(readFileSync(path, "utf8")) as WooriOperatingLeaseFixture;
}

function assertWithinTolerance(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: expected ${expected}, got ${actual}`).toBeLessThanOrEqual(tolerance);
}

// ---------------------------------------------------------------------------
// Fixture-driven tests
// ---------------------------------------------------------------------------

const fixtureDir =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/fixtures/woori-card/operating-lease";

for (const fileName of readdirSync(fixtureDir).filter((entry) => entry.endsWith(".json")).sort()) {
  test(`Woori operating lease fixture: ${fileName}`, () => {
    const fixture = loadFixture(`${fixtureDir}/${fileName}`);

    const quote = calculateWooriOperatingLeaseQuoteFromContext({
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
      policyBaseIrr: fixture.policyBaseIrr ?? 0.045,
      providerRates: fixture.providerRates ?? [],
    });

    expect(quote.lenderCode).toBe("woori-card");
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
    }
    assertWithinTolerance(
      quote.monthlyPayment,
      fixture.expected.monthlyPayment,
      fixture.tolerance.monthlyPayment,
      "monthlyPayment",
    );

    // Provider selection check
    if (fixture.expected.selectedProvider) {
      expect(quote.residual.candidateSummary?.selectedCandidateName).toBe(fixture.expected.selectedProvider);
    }
  });
}

// ---------------------------------------------------------------------------
// Unit tests — specific calculation checks
// ---------------------------------------------------------------------------

test("Woori: financedPrincipal is gross (no upfront subtraction)", () => {
  // Two quotes: one with upfront, one without. financedPrincipal should be identical.
  const base = loadFixture(`${fixtureDir}/bmw-520i-60-base.json`);
  const withUpfront = loadFixture(`${fixtureDir}/bmw-520i-60-upfront-10m-deposit-10m.json`);
  expect(base.expected.financedPrincipal).toBe(withUpfront.expected.financedPrincipal);
});

test("Woori: deposit reduces PMT but not financedPrincipal", () => {
  const base = loadFixture(`${fixtureDir}/bmw-520i-60-base.json`);
  const withDeposit = loadFixture(`${fixtureDir}/bmw-520i-60-deposit-20m.json`);
  expect(base.expected.financedPrincipal).toBe(withDeposit.expected.financedPrincipal);
  expect(withDeposit.expected.monthlyPayment < base.expected.monthlyPayment).toBe(true);
});

test("Woori: customer IRR higher than company IRR", () => {
  const company = loadFixture(`${fixtureDir}/bmw-520i-60-base.json`);
  const customer = loadFixture(`${fixtureDir}/bmw-520i-60-customer.json`);
  expect(customer.expected.displayedAnnualRateDecimal > company.expected.displayedAnnualRateDecimal).toBe(true);
});

test("Woori: discount reduces discountedVehiclePrice", () => {
  const base = loadFixture(`${fixtureDir}/bmw-520i-60-base.json`);
  const discount = loadFixture(`${fixtureDir}/bmw-520i-60-discount-5m.json`);
  expect(discount.expected.discountedVehiclePrice).toBe(
    base.expected.discountedVehiclePrice - 5000000
  );
});

test("Woori: EV gets acquisition tax exemption", () => {
  const taycan = loadFixture(`${fixtureDir}/porsche-taycan4-60-base.json`);
  // Taycan is EV: acqTax should be reduced by 1,400,000
  const fullTax = Math.floor((100000000 / 1.1) * 0.07 / 10) * 10; // 6,363,630
  expect(taycan.expected.acquisitionTax).toBe(fullTax - 1400000);
});

test("Woori: stamp duty is always 10,000", () => {
  const base = loadFixture(`${fixtureDir}/bmw-520i-60-base.json`);
  expect(base.expected.stampDuty).toBe(10000);
});

test("Woori: shorter term → higher monthly payment", () => {
  const t60 = loadFixture(`${fixtureDir}/bmw-520i-60-base.json`);
  const t48 = loadFixture(`${fixtureDir}/bmw-520i-48-base.json`);
  const t36 = loadFixture(`${fixtureDir}/bmw-520i-36-base.json`);
  const t24 = loadFixture(`${fixtureDir}/bmw-520i-24-base.json`);
  const t12 = loadFixture(`${fixtureDir}/bmw-520i-12-base.json`);
  expect(t12.expected.monthlyPayment > t24.expected.monthlyPayment).toBe(true);
  expect(t24.expected.monthlyPayment > t36.expected.monthlyPayment).toBe(true);
  expect(t36.expected.monthlyPayment > t48.expected.monthlyPayment).toBe(true);
  expect(t48.expected.monthlyPayment > t60.expected.monthlyPayment).toBe(true);
});
