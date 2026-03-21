import type { QuoteProductType } from "@/domain/imports/types";

export type QuoteOwnershipType = "company" | "customer";
export type QuoteDiscountMode = "amount" | "rate";
export type QuoteAcquisitionTaxMode = "automatic" | "ratio" | "reduction" | "amount";
export type QuoteResidualValueMode = "vehicle-price-ratio" | "acquisition-cost-ratio" | "amount";

export type CanonicalQuoteInput = {
  lenderCode: string;
  productType: QuoteProductType;
  brand: string;
  modelName: string;
  ownershipType: QuoteOwnershipType;
  leaseTermMonths: 12 | 24 | 36 | 48 | 60;
  annualMileageKm?: 10000 | 20000 | 30000 | 35000;
  upfrontPayment: number;
  depositAmount?: number;
  quotedVehiclePrice?: number;
  additionalVehiclePrice?: number;
  discountMode?: QuoteDiscountMode;
  discountAmount?: number;
  discountRate?: number;
  annualIrrRateOverride?: number;
  annualEffectiveRateOverride?: number;
  paymentRateOverride?: number;
  residualRateOverride?: number;
  selectedResidualRateOverride?: number;
  residualMatrixGroup?: string;
  residualValueMode?: QuoteResidualValueMode;
  residualValueRatio?: number;
  residualAmountOverride?: number;
  acquisitionTaxMode?: QuoteAcquisitionTaxMode;
  acquisitionTaxRateOverride?: number;
  acquisitionTaxRatioInput?: number;
  acquisitionTaxReduction?: number;
  acquisitionTaxAmountOverride?: number;
  publicBondCost?: number;
  stampDuty?: number;
  agFeeRate?: number;
  cmFeeRate?: number;
  insuranceMonthly?: number;
  lossDamageAmount?: number;
};

export type CanonicalQuoteResult = {
  lenderCode: string;
  productType: QuoteProductType;
  workbookImport: {
    id: string;
    versionLabel: string;
  };
  resolvedVehicle: {
    brand: string;
    modelName: string;
    vehiclePrice: number;
    vehicleClass: string | null;
    engineDisplacementCc: number | null;
    highResidualAllowed: boolean | null;
    hybridAllowed: boolean | null;
    snkResidualBand: string | null;
    residualPromotionCode: string | null;
  };
  majorInputs: {
    ownershipType: QuoteOwnershipType;
    leaseTermMonths: 12 | 24 | 36 | 48 | 60;
    vehiclePrice: number;
    discountedVehiclePrice: number;
    upfrontPayment: number;
    depositAmount: number;
    financedPrincipal: number;
  };
  feesAndTaxes: {
    acquisitionTax: number;
    registrationTax: number;
    publicBondCost: number;
    stampDuty: number;
    extraFees: number;
  };
  residual: {
    matrixGroup: string | null;
    source: "override" | "vehicle-program" | "residual-matrix";
    rateDecimal: number;
    amount: number;
    minRateDecimal?: number;
    maxRateDecimal?: number;
    selectionGuide?: {
      requiresUserConfirmation: boolean;
      defaultRateDecimal: number;
      reason: string | null;
    };
    candidateSummary?: {
      maxBoostedRate: number | null;
      selectedCandidateName: string | null;
      candidates: Array<{
        name: string;
        baseRate: number;
        mileageAdjustedRate: number;
        boostedRate: number;
      }>;
    };
  };
  rates: {
    source: "override" | "brand-policy" | "workbook-heuristic";
    annualRateDecimal: number;
    effectiveAnnualRateDecimal: number;
    monthlyRateDecimal: number;
  };
  monthlyPayment: number;
  warnings: string[];
};
