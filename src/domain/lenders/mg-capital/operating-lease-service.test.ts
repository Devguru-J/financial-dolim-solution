import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import {
  calculateMgOperatingLeaseQuoteFromResolvedInput,
  resolveMgOperatingLeaseResidualRate,
  summarizeMgResidualCandidates,
} from "@/domain/lenders/mg-capital/operating-lease-service";

type OperatingLeaseFixture = {
  name: string;
  workbookVersion: string;
  workbookDebug?: {
    selectedResidualRatio?: number;
    maxResidualRatio?: number;
    residualGapRatio?: number;
    residualGuaranteeCompany?: string;
    guaranteeBaseRatio?: number;
    guaranteePromoRatio?: number;
  };
  vehicle?: {
    vehiclePrice: string;
    vehicleClass: string | null;
    engineDisplacementCc: number | null;
    highResidualAllowed: boolean | null;
    hybridAllowed: boolean | null;
    residualPromotionCode: string | null;
    snkResidualBand: string | null;
  };
  input: {
    lenderCode: "mg-capital";
    productType: "operating_lease";
    brand: string;
    modelName: string;
    ownershipType: "company" | "customer";
    leaseTermMonths: 12 | 24 | 36 | 48 | 60;
    annualMileageKm?: 10000 | 20000 | 30000 | 35000;
    upfrontPayment: number;
    quotedVehiclePrice?: number;
    discountAmount?: number;
    annualIrrRateOverride?: number;
    annualEffectiveRateOverride?: number;
    paymentRateOverride?: number;
    residualRateOverride?: number;
    residualValueMode?: "vehicle-price-ratio" | "acquisition-cost-ratio" | "amount";
    residualValueRatio?: number;
    residualAmountOverride?: number;
    publicBondCost?: number;
    stampDuty?: number;
    acquisitionTaxRateOverride?: number;
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
  };
};

function loadFixture(path: string): OperatingLeaseFixture {
  return JSON.parse(readFileSync(path, "utf8")) as OperatingLeaseFixture;
}

function assertWithinTolerance(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: expected ${expected}, got ${actual}`).toBeLessThanOrEqual(tolerance);
}

const fixtureDir =
  "/Users/tuesdaymorning/Devguru/financial-dolim-solution/fixtures/mg-capital/operating-lease";

for (const fileName of readdirSync(fixtureDir).filter((entry) => entry.endsWith(".json")).sort()) {
  test(`MG operating lease fixture matches workbook: ${fileName}`, () => {
    const fixture = loadFixture(`${fixtureDir}/${fileName}`);

    const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
      workbookImport: {
        id: "fixture-workbook-import",
        versionLabel: fixture.workbookVersion,
      },
      input: fixture.input,
      vehicle: {
        brand: fixture.input.brand,
        modelName: fixture.input.modelName,
        vehiclePrice: fixture.vehicle?.vehiclePrice ?? "152700000",
        vehicleClass: fixture.vehicle?.vehicleClass ?? "승용SUV(~5인)",
        engineDisplacementCc: fixture.vehicle?.engineDisplacementCc ?? 2993,
        highResidualAllowed: fixture.vehicle?.highResidualAllowed ?? true,
        hybridAllowed: fixture.vehicle?.hybridAllowed ?? false,
        residualPromotionCode: fixture.vehicle?.residualPromotionCode ?? "0",
        snkResidualBand: fixture.vehicle?.snkResidualBand ?? "F",
        term12Residual: null,
        term24Residual: null,
        term36Residual: null,
        term48Residual: null,
        term60Residual: null,
        rawRow: null,
      },
      displayedAnnualRateRaw: fixture.input.annualIrrRateOverride ?? fixture.expected.displayedAnnualRateDecimal,
      residualRateRaw: fixture.input.residualRateOverride ?? fixture.input.residualValueRatio ?? 0,
      residualSource: "override",
      resolvedMatrixGroup: null,
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
    expect(quote.rates.annualRateDecimal).toBe(fixture.expected.displayedAnnualRateDecimal);
    expect(quote.rates.effectiveAnnualRateDecimal).toBe(fixture.expected.effectiveAnnualRateDecimal);
    assertWithinTolerance(
      quote.monthlyPayment,
      fixture.expected.monthlyPayment,
      fixture.tolerance.monthlyPayment,
      "monthlyPayment",
    );
  });
}

test("MG residual resolver prefers SNK matrix rows before APS fallback", () => {
  const resolved = resolveMgOperatingLeaseResidualRate({
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "VOLVO",
      modelName: "XC40 B4 AWD Ultra Dark",
      ownershipType: "company",
      leaseTermMonths: 36,
      upfrontPayment: 0,
    },
    vehicle: {
      snkResidualBand: "L",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
    },
    matrixRows: [
      { matrixGroup: "APS", residualRate: "0.51" },
      { matrixGroup: "에스앤케이모터스", residualRate: "0.53" },
    ],
  });

  expect(resolved.residualRateRaw).toBe(0.53);
  expect(resolved.residualSource).toBe("residual-matrix");
  expect(resolved.resolvedMatrixGroup).toBe("에스앤케이모터스");
});

test("MG residual resolver respects explicit matrix group override", () => {
  const resolved = resolveMgOperatingLeaseResidualRate({
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "VOLVO",
      modelName: "XC40 B4 AWD Ultra Dark",
      ownershipType: "company",
      leaseTermMonths: 36,
      upfrontPayment: 0,
      residualMatrixGroup: "APS",
    },
    vehicle: {
      snkResidualBand: "L",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
    },
    matrixRows: [
      { matrixGroup: "에스앤케이모터스", residualRate: "0.53" },
      { matrixGroup: "APS", residualRate: "0.51" },
    ],
  });

  expect(resolved.residualRateRaw).toBe(0.51);
  expect(resolved.resolvedMatrixGroup).toBe("APS");
});

test("MG residual resolver fails like workbook when no residual band exists", () => {
  expect(() =>
    resolveMgOperatingLeaseResidualRate({
      input: {
        lenderCode: "mg-capital",
        productType: "operating_lease",
        brand: "AUDI",
        modelName: "S3 TFSI",
        ownershipType: "company",
        leaseTermMonths: 36,
        upfrontPayment: 0,
      },
      vehicle: {
        snkResidualBand: null,
        term12Residual: null,
        term24Residual: null,
        term36Residual: null,
        term48Residual: null,
        term60Residual: null,
      },
      matrixRows: [],
    }),
  ).toThrow("Residual rate not found for term '36' and grade '-'.");
});

test("MG residual candidates match AUDI company hidden-sheet summary", () => {
  const summary = summarizeMgResidualCandidates({
    input: {
      leaseTermMonths: 36,
      ownershipType: "company",
    },
    vehicle: {
      highResidualAllowed: true,
      rawRow: {
        snkResiduals: {},
        apsResiduals: {},
        chatbotResiduals: {},
        residuals: { 36: 0.53 },
        snkPromotionRate: 0,
      },
    },
    annualMileageKm: 20000,
  });

  expect(summary.maxBoostedRate).toBe(0.61);
  expect(summary.selectedCandidateName).toBe("에스앤케이모터스");
});

test("MG residual candidates match VOLVO company hidden-sheet summary", () => {
  const summary = summarizeMgResidualCandidates({
    input: {
      leaseTermMonths: 36,
      ownershipType: "company",
    },
    vehicle: {
      highResidualAllowed: true,
      rawRow: {
        snkResiduals: {},
        apsResiduals: { 36: 0.58 },
        chatbotResiduals: {},
        residuals: { 36: 0.58 },
        apsPromotionRate: 0.075,
        snkPromotionRate: 0,
      },
    },
    annualMileageKm: 20000,
  });

  assertWithinTolerance(summary.maxBoostedRate ?? 0, 0.66, 0.0000001, "volvo maxBoostedRate");
  expect(summary.selectedCandidateName).toBe("APS");
});

test("MG selectedResidualRateOverride reproduces workbook-selected residual without amount override", () => {
  const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제",
    },
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "customer",
      leaseTermMonths: 36,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 46400000,
      discountAmount: 0,
      annualIrrRateOverride: 0.1,
      annualEffectiveRateOverride: 0.099999236361,
      paymentRateOverride: 0.1001,
      selectedResidualRateOverride: 0.525,
      acquisitionTaxRateOverride: 0.07,
      publicBondCost: 0,
      stampDuty: 10000,
    },
    vehicle: {
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      vehiclePrice: "46400000",
      vehicleClass: "승용일반",
      engineDisplacementCc: 1984,
      highResidualAllowed: true,
      hybridAllowed: false,
      residualPromotionCode: "0",
      snkResidualBand: "P",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
      rawRow: {
        snkResiduals: {},
        apsResiduals: {},
        chatbotResiduals: {},
        residuals: { 36: 0.53 },
        snkPromotionRate: 0,
      },
    },
    displayedAnnualRateRaw: 0.1,
    residualRateRaw: 0.53,
    residualSource: "override",
    resolvedMatrixGroup: null,
  });

  expect(quote.residual.amount).toBe(24360000);
  assertWithinTolerance(quote.residual.rateDecimal, 0.525, 0.0000001, "selected residual rateDecimal");
  expect(quote.residual.selectionGuide?.requiresUserConfirmation).toBe(false);
  expect(quote.monthlyPayment).toBe(1009765);
});

test("MG quote exposes residual selection guide when workbook-style confirmation is still needed", () => {
  const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제",
    },
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "company",
      leaseTermMonths: 36,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      quotedVehiclePrice: 46400000,
      discountAmount: 0,
      annualIrrRateOverride: 0.047,
      annualEffectiveRateOverride: 0.04699540291,
      paymentRateOverride: 0.04709,
      acquisitionTaxRateOverride: 0.07,
      publicBondCost: 0,
      stampDuty: 10000,
    },
    vehicle: {
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      vehiclePrice: "46400000",
      vehicleClass: "승용일반",
      engineDisplacementCc: 1984,
      highResidualAllowed: true,
      hybridAllowed: false,
      residualPromotionCode: "0",
      snkResidualBand: "P",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
      rawRow: {
        snkResiduals: {},
        apsResiduals: {},
        chatbotResiduals: {},
        residuals: { 36: 0.53 },
        snkPromotionRate: 0,
      },
    },
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.53,
    residualSource: "override",
    resolvedMatrixGroup: null,
  });

  expect(quote.residual.selectionGuide?.requiresUserConfirmation).toBe(true);
});
