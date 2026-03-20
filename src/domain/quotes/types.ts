import type { QuoteProductType } from "@/domain/imports/types";

export type QuoteOwnershipType = "company" | "customer";

export type CanonicalQuoteInput = {
  lenderCode: string;
  productType: QuoteProductType;
  brand: string;
  modelName: string;
  ownershipType: QuoteOwnershipType;
  leaseTermMonths: 12 | 24 | 36 | 48 | 60;
  upfrontPayment: number;
  annualIrrRateOverride?: number;
  residualRateOverride?: number;
  residualMatrixGroup?: string;
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
    upfrontPayment: number;
    financedPrincipal: number;
  };
  feesAndTaxes: {
    acquisitionTax: number;
    registrationTax: number;
    extraFees: number;
  };
  residual: {
    matrixGroup: string | null;
    source: "override" | "vehicle-program" | "residual-matrix";
    rateDecimal: number;
    amount: number;
  };
  rates: {
    source: "override" | "brand-policy";
    annualRateDecimal: number;
    monthlyRateDecimal: number;
  };
  monthlyPayment: number;
  warnings: string[];
};
