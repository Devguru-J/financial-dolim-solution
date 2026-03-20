export type QuoteProductType = "operating_lease" | "financial_lease" | "installment_loan";

export type WorkbookVehicleProgram = {
  brand: string;
  modelName: string;
  engineDisplacementCc: number | null;
  vehicleClass: string | null;
  vehiclePrice: number;
  residuals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  highResidualAllowed: boolean;
  hybridAllowed: boolean;
  residualPromotionCode: string | null;
  snkResidualBand: string | null;
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
};

export type PersistWorkbookImportResult = {
  id: string | null;
  lenderCode: string;
  versionLabel: string;
  persisted: boolean;
  persistenceMode: "database" | "skipped";
  analysis: WorkbookPreview["analysis"];
};
