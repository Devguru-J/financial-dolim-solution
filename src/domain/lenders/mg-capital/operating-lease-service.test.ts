import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import {
  calculateMgOperatingLeaseQuoteFromResolvedInput,
  resolveMgOperatingLeaseResidualRate,
  resolveWorkbookDisplayedAnnualRate,
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
  resolvedMatrixGroup?: string;
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
    baseIrrRate?: number;
    annualIrrRateOverride?: number;
    annualEffectiveRateOverride?: number;
    paymentRateOverride?: number;
    residualRateOverride?: number;
    residualValueMode?: "vehicle-price-ratio" | "acquisition-cost-ratio" | "amount";
    residualValueRatio?: number;
    residualAmountOverride?: number;
    maximumResidualRateOverride?: number;
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
    displayedAnnualRateDecimal?: number;
    effectiveAnnualRateDecimal?: number;
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
      displayedAnnualRateRaw: fixture.input.annualIrrRateOverride ?? fixture.input.baseIrrRate ?? fixture.expected.displayedAnnualRateDecimal,
      residualRateRaw: fixture.input.residualRateOverride ?? fixture.input.residualValueRatio ?? 0,
      maximumResidualRateRaw: fixture.input.maximumResidualRateOverride ?? undefined,
      residualSource: "override",
      resolvedMatrixGroup: fixture.resolvedMatrixGroup ?? null,
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
      rawRow: null,
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
      rawRow: null,
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
        rawRow: null,
      },
      matrixRows: [],
    }),
  ).toThrow("Residual rate not found for term '36' and grade '-'.");
});

test("MG BMW X7 company 60-month 54.5% residual uses APS guarantee fee path for displayed annual rate", () => {
  const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "★MG캐피탈_수입견적_26.03월_외부용_2603_vol1",
    },
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "BMW",
      modelName: "X7 xDrive 40d DPE (6인승)",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 152700000,
      acquisitionTaxRateOverride: 0.07,
      selectedResidualRateOverride: 0.545,
      agFeeRate: 0,
      cmFeeRate: 0,
    },
    vehicle: {
      brand: "BMW",
      modelName: "X7 xDrive 40d DPE (6인승)",
      vehiclePrice: "152700000",
      vehicleClass: "승용SUV(~5인)",
      engineDisplacementCc: 2993,
      highResidualAllowed: true,
      hybridAllowed: false,
      residualPromotionCode: "0",
      snkResidualBand: "F",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
      rawRow: {
        apsResiduals: { 60: 0.49 },
        apsPromotionRate: 0.025,
        snkPromotionRate: 0.025,
      },
    },
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.545,
    maximumResidualRateRaw: 0.595,
    residualSource: "override",
    resolvedMatrixGroup: "에스앤케이모터스",
  });

  assertWithinTolerance(quote.residual.maxRateDecimal ?? 0, 0.595, 0.000001, "bmw x7 maxResidualRate");
  assertWithinTolerance(quote.rates.annualRateDecimal, 0.04821, 0.00002, "bmw x7 displayedAnnualRate");
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

  assertWithinTolerance(summary.maxBoostedRate ?? 0, 0.735, 0.0000001, "volvo maxBoostedRate");
  expect(summary.selectedCandidateName).toBe("APS");
});

test("MG residual candidates supplement missing SNK data from matrix rows", () => {
  const summary = summarizeMgResidualCandidates({
    input: {
      leaseTermMonths: 60,
      ownershipType: "company",
    },
    vehicle: {
      highResidualAllowed: true,
      rawRow: {
        snkResiduals: {},
        apsResiduals: { 60: 0.36 },
        chatbotResiduals: {},
        apsResidualBand: "M",
      },
    },
    annualMileageKm: 20000,
    matrixRows: [
      { matrixGroup: "에스앤케이모터스", residualRate: "0.38" },
      { matrixGroup: "APS", residualRate: "0.36" },
    ],
    selectedResidualRateDecimal: 0.36,
  });

  expect(summary.candidates.map((candidate) => candidate.name).sort().join("|")).toBe("APS|에스앤케이모터스");
  assertWithinTolerance(summary.maxBoostedRate ?? 0, 0.46, 0.0000001, "maybach maxBoostedRate");
  expect(summary.selectedCandidateName).toBe("에스앤케이모터스");
});

test("MG residual candidates choose APS on equal boosted residual when APS fee is lower", () => {
  const summary = summarizeMgResidualCandidates({
    input: {
      leaseTermMonths: 60,
      ownershipType: "company",
    },
    vehicle: {
      highResidualAllowed: true,
      rawRow: {
        snkResiduals: { 60: 0.5 },
        apsResiduals: { 60: 0.495 },
        chatbotResiduals: {},
        apsPromotionRate: 0.005,
        snkPromotionRate: 0,
      },
    },
    annualMileageKm: 20000,
    selectedResidualRateDecimal: 0.5,
  });

  assertWithinTolerance(summary.maxBoostedRate ?? 0, 0.58, 0.0000001, "e200 maxBoostedRate");
  expect(summary.selectedCandidateName).toBe("APS");
});

test("MG BENZ Maybach GLS 600 4Matic 60-month candidate path keeps SNK as selected company", () => {
  const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "★MG캐피탈_수입견적_26.03월_외부용_2603_vol1",
    },
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "BENZ",
      modelName: "Maybach GLS 600 4Matic",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 280700000,
      selectedResidualRateOverride: 0.36,
      agFeeRate: 0,
      cmFeeRate: 0,
      acquisitionTaxRateOverride: 0.07,
    },
    vehicle: {
      brand: "BENZ",
      modelName: "Maybach GLS 600 4Matic",
      vehiclePrice: "280700000",
      vehicleClass: "승용SUV(7~10인)",
      engineDisplacementCc: 3982,
      highResidualAllowed: true,
      hybridAllowed: false,
      residualPromotionCode: null,
      snkResidualBand: "Q",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
      rawRow: {
        apsResidualBand: "M",
        apsResiduals: { 60: 0.36 },
        snkResiduals: {},
        chatbotResiduals: {},
      },
    },
    matrixRows: [
      { matrixGroup: "에스앤케이모터스", residualRate: "0.38" },
      { matrixGroup: "APS", residualRate: "0.36" },
    ],
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.38,
    maximumResidualRateRaw: 0.46,
    residualSource: "residual-matrix",
    resolvedMatrixGroup: "에스앤케이모터스",
  });

  expect(quote.residual.candidateSummary?.selectedCandidateName).toBe("에스앤케이모터스");
  assertWithinTolerance(quote.residual.maxRateDecimal ?? 0, 0.46, 0.0000001, "maybach max residual");
});

test("MG BENZ E 200 Avantgarde Limited 60-month candidate path selects APS on equal boosted residual", () => {
  const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "★MG캐피탈_수입견적_26.03월_외부용_2603_vol1",
    },
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "BENZ",
      modelName: "E 200 Avantgarde Limited",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      depositAmount: 0,
      quotedVehiclePrice: 69000000,
      selectedResidualRateOverride: 0.5,
      agFeeRate: 0,
      cmFeeRate: 0,
      acquisitionTaxRateOverride: 0.07,
    },
    vehicle: {
      brand: "BENZ",
      modelName: "E 200 Avantgarde Limited",
      vehiclePrice: "69000000",
      vehicleClass: "승용일반",
      engineDisplacementCc: 1999,
      highResidualAllowed: true,
      hybridAllowed: false,
      residualPromotionCode: null,
      snkResidualBand: "E",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
      rawRow: {
        apsResidualBand: "SA1",
        apsResiduals: { 60: 0.495 },
        apsPromotionRate: 0.005,
        snkResiduals: { 60: 0.5 },
        snkPromotionRate: 0,
        chatbotResiduals: {},
      },
    },
    matrixRows: [
      { matrixGroup: "에스앤케이모터스", residualRate: "0.50" },
      { matrixGroup: "APS", residualRate: "0.495" },
    ],
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.5,
    maximumResidualRateRaw: 0.58,
    residualSource: "residual-matrix",
    resolvedMatrixGroup: "에스앤케이모터스",
  });

  expect(quote.residual.candidateSummary?.selectedCandidateName).toBe("APS");
  assertWithinTolerance(quote.residual.maxRateDecimal ?? 0, 0.58, 0.0000001, "e200 max residual");
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

test("MG workbook base annual rate resolves to brand policy without hardcoded heuristic", () => {
  const resolved = resolveWorkbookDisplayedAnnualRate({
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "company",
      leaseTermMonths: 60,
      upfrontPayment: 0,
    },
    baseIrrRateRaw: 0.047,
  });

  expect(resolved.source).toBe("brand-policy");
  expect(resolved.displayedAnnualRateRaw).toBe(0.047);
});

test("MG displayed annual rate changes when AUDI company 60-month selected residual changes", () => {
  const common = {
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제",
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
      snkResidualBand: "F",
      term12Residual: null,
      term24Residual: null,
      term36Residual: null,
      term48Residual: null,
      term60Residual: null,
      rawRow: null,
    },
    displayedAnnualRateRaw: 0.047,
    maximumResidualRateRaw: 0.47,
    residualSource: "override" as const,
    resolvedMatrixGroup: null,
  };

  const quote43 = calculateMgOperatingLeaseQuoteFromResolvedInput({
    ...common,
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      selectedResidualRateOverride: 0.43,
    },
    residualRateRaw: 0.43,
  });

  const quote44 = calculateMgOperatingLeaseQuoteFromResolvedInput({
    ...common,
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      selectedResidualRateOverride: 0.44,
    },
    residualRateRaw: 0.44,
  });

  const quote45 = calculateMgOperatingLeaseQuoteFromResolvedInput({
    ...common,
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      selectedResidualRateOverride: 0.45,
    },
    residualRateRaw: 0.45,
  });

  expect(quote43.rates.source).toBe("workbook-formula");
  expect(quote43.rates.annualRateDecimal < quote44.rates.annualRateDecimal).toBe(true);
  expect(quote44.rates.annualRateDecimal < quote45.rates.annualRateDecimal).toBe(true);
  expect(quote43.residual.minRateDecimal).toBe(0.15);
  expect(quote43.residual.maxRateDecimal).toBe(0.47);
});

test("MG AUDI company 60-month 43% selected residual follows SNK workbook fee table", () => {
  const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
    workbookImport: {
      id: "fixture-workbook-import",
      versionLabel: "reference workbook",
    },
    input: {
      lenderCode: "mg-capital",
      productType: "operating_lease",
      brand: "AUDI",
      modelName: "A3 40 TFSI Premium",
      ownershipType: "company",
      leaseTermMonths: 60,
      annualMileageKm: 20000,
      upfrontPayment: 0,
      quotedVehiclePrice: 46400000,
      discountAmount: 0,
      selectedResidualRateOverride: 0.43,
      acquisitionTaxRateOverride: 0.07,
      publicBondCost: 0,
      miscFeeAmount: 0,
      deliveryFeeAmount: 0,
      stampDuty: 0,
      agFeeRate: 0,
      cmFeeRate: 0,
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
      rawRow: null,
    },
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.43,
    maximumResidualRateRaw: 0.47,
    residualSource: "override",
    resolvedMatrixGroup: "에스앤케이모터스",
  });

  assertWithinTolerance(quote.rates.annualRateDecimal, 0.04961, 0.0002, "audi 60m 43% displayed annual rate");
});

test("MG AG/CM fee rates affect financed cost and monthly payment", () => {
  const quoteWithoutFees = calculateMgOperatingLeaseQuoteFromResolvedInput({
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
      selectedResidualRateOverride: 0.45,
      acquisitionTaxRateOverride: 0.07,
      publicBondCost: 0,
      stampDuty: 10000,
      agFeeRate: 0,
      cmFeeRate: 0,
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
      rawRow: null,
    },
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.45,
    residualSource: "override",
    resolvedMatrixGroup: null,
  });

  const quoteWithFees = calculateMgOperatingLeaseQuoteFromResolvedInput({
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
      selectedResidualRateOverride: 0.45,
      acquisitionTaxRateOverride: 0.07,
      publicBondCost: 0,
      stampDuty: 10000,
      agFeeRate: 0.01,
      cmFeeRate: 0.005,
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
      rawRow: null,
    },
    displayedAnnualRateRaw: 0.047,
    residualRateRaw: 0.45,
    residualSource: "override",
    resolvedMatrixGroup: null,
  });

  expect(quoteWithoutFees.feesAndTaxes.extraFees).toBe(0);
  expect(quoteWithFees.feesAndTaxes.extraFees > 0).toBe(true);
  expect(quoteWithFees.majorInputs.financedPrincipal > quoteWithoutFees.majorInputs.financedPrincipal).toBe(true);
});
