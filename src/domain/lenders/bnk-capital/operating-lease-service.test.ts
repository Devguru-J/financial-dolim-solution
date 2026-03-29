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
