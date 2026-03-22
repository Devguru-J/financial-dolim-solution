export type QuoteProductType = "operating_lease" | "financial_lease" | "installment_loan";

export type WorkbookVehicleProgram = {
  brand: string;
  modelName: string;
  engineDisplacementCc: number | null;
  vehicleClass: string | null;
  vehiclePrice: number;
  residuals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  snkResiduals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  apsResidualBand: string | null;
  apsResiduals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  chatbotResiduals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  highResidualAllowed: boolean;
  hybridAllowed: boolean;
  residualPromotionCode: string | null;
  snkResidualBand: string | null;
  apsPromotionRate: number | null;
  snkPromotionRate: number | null;
};

export type WorkbookResidualMatrixRow = {
  matrixGroup: string;
  gradeCode: string;
  leaseTermMonths: number;
  residualRate: number;
};

export type WorkbookBrandRatePolicy = {
  brand: string;
  productType: QuoteProductType;
  ownershipType: "company" | "customer";
  baseIrrRate: number;
};

export type WorkbookSheetFieldSnapshot = {
  cell: string;
  value: string | number | boolean | null;
  displayText: string | null;
  formula: string | null;
};

export type WorkbookOperatingLeaseSheetContract = {
  sheetName: "운용리스";
  consistency: {
    matchedVehicleProgram: boolean;
    matchedBrand: string | null;
    matchedModelName: string | null;
    expectedVehiclePrice: number | null;
    actualVehiclePrice: number | null;
    vehiclePriceMatches: boolean;
    message: string | null;
  };
  fields: {
    brand: WorkbookSheetFieldSnapshot;
    modelName: WorkbookSheetFieldSnapshot;
    vehicleClass: WorkbookSheetFieldSnapshot;
    engineDisplacementCc: WorkbookSheetFieldSnapshot;
    directInputVehiclePrice: WorkbookSheetFieldSnapshot;
    basicVehiclePrice: WorkbookSheetFieldSnapshot;
    optionAmount: WorkbookSheetFieldSnapshot;
    discountMode: WorkbookSheetFieldSnapshot;
    discountAmount: WorkbookSheetFieldSnapshot;
    invoiceVehiclePrice: WorkbookSheetFieldSnapshot;
    ownershipLabel: WorkbookSheetFieldSnapshot;
    publicBondRate: WorkbookSheetFieldSnapshot;
    publicBondAmount: WorkbookSheetFieldSnapshot;
    miscFeeAmount: WorkbookSheetFieldSnapshot;
    deliveryFeeAmount: WorkbookSheetFieldSnapshot;
    acquisitionTaxMode: WorkbookSheetFieldSnapshot;
    acquisitionTaxRate: WorkbookSheetFieldSnapshot;
    leaseTermMonths: WorkbookSheetFieldSnapshot;
    upfrontPaymentAmount: WorkbookSheetFieldSnapshot;
    depositMode: WorkbookSheetFieldSnapshot;
    annualMileageKm: WorkbookSheetFieldSnapshot;
    residualMode: WorkbookSheetFieldSnapshot;
    selectedResidualRate: WorkbookSheetFieldSnapshot;
    minResidualRate: WorkbookSheetFieldSnapshot;
    maxResidualRate: WorkbookSheetFieldSnapshot;
    agFeeRate: WorkbookSheetFieldSnapshot;
    cmFeeRate: WorkbookSheetFieldSnapshot;
    carTaxMode: WorkbookSheetFieldSnapshot;
    insuranceYearlyAmount: WorkbookSheetFieldSnapshot;
    lossDamageAmount: WorkbookSheetFieldSnapshot;
    extraService: WorkbookSheetFieldSnapshot;
    salesOwner: WorkbookSheetFieldSnapshot;
    appliedAnnualRate: WorkbookSheetFieldSnapshot;
  };
};

export type WorkbookSheetContracts = {
  operatingLease: WorkbookOperatingLeaseSheetContract | null;
};

export type WorkbookPreview = {
  lenderCode: string;
  lenderName: string;
  sourceFileName: string;
  detectedVersionLabel: string;
  sheetNames: string[];
  analysis: {
    hasVehicleDb: boolean;
    hasResidualMap: boolean;
    hasBrandRatePolicies: boolean;
    vehicleProgramCount: number;
    residualMatrixRowCount: number;
    brandRatePolicyCount: number;
  };
  vehiclePrograms: WorkbookVehicleProgram[];
  residualMatrixRows: WorkbookResidualMatrixRow[];
  brandRatePolicies: WorkbookBrandRatePolicy[];
  sheetContracts: WorkbookSheetContracts;
};

export type PersistWorkbookImportResult = {
  id: string | null;
  lenderCode: string;
  versionLabel: string;
  persisted: boolean;
  persistenceMode: "database" | "skipped";
  analysis: WorkbookPreview["analysis"];
};
