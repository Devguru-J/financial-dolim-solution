import * as XLSX from "xlsx";

export type MgWorkbookParseOptions = {
  lenderCode: string;
  fileName: string;
};

type VehicleProgram = {
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

type ResidualMatrixRow = {
  matrixGroup: string;
  gradeCode: string;
  leaseTermMonths: number;
  residualRate: number;
};

type BrandRatePolicy = {
  brand: string;
  productType: "operating_lease" | "financial_lease" | "installment_loan";
  ownershipType: "company" | "customer";
  baseIrrRate: number;
};

type WorkbookPreview = {
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
  vehiclePrograms: VehicleProgram[];
  residualMatrixRows: ResidualMatrixRow[];
  brandRatePolicies: BrandRatePolicy[];
};

const REQUIRED_SHEETS = ["차량DB", "잔가map", "견적관리자용"] as const;

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  }) as unknown[][];
}

function readCell(sheet: XLSX.WorkSheet, address: string): unknown {
  return sheet[address]?.v ?? null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replaceAll(",", "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function parseVehiclePrograms(rows: unknown[][]): VehicleProgram[] {
  const parsedRows: Array<VehicleProgram | null> = rows.slice(5).map((row) => {
    const brand = asText(row[4]);
    const modelName = asText(row[5]);
    const vehiclePrice = asNumber(row[8]);

    if (!brand || !modelName || !vehiclePrice) {
      return null;
    }

    return {
      brand,
      modelName,
      engineDisplacementCc: asNumber(row[6]),
      vehicleClass: asText(row[7]),
      vehiclePrice,
      residuals: {
        12: asNumber(row[9]) ?? undefined,
        24: asNumber(row[10]) ?? undefined,
        36: asNumber(row[11]) ?? undefined,
        48: asNumber(row[12]) ?? undefined,
        60: asNumber(row[13]) ?? undefined,
      },
      highResidualAllowed: asText(row[15]) === "Y",
      hybridAllowed: asText(row[16]) === "Y",
      residualPromotionCode: asText(row[17]),
      snkResidualBand: asText(row[18]),
    };
  });

  return parsedRows.filter((row): row is VehicleProgram => row !== null);
}

function parseResidualMatrix(rows: unknown[][]): ResidualMatrixRow[] {
  const sections: Array<{ title: string; headerRowIndex: number; valueRowStartIndex: number }> = [];

  rows.forEach((row, index) => {
    const firstCell = asText(row[0]);
    if (firstCell?.startsWith("■ ")) {
      sections.push({
        title: firstCell.replace("■ ", ""),
        headerRowIndex: index + 1,
        valueRowStartIndex: index + 2,
      });
    }
  });

  const matrixRows: ResidualMatrixRow[] = [];

  for (const section of sections) {
    const headerRow = rows[section.headerRowIndex] ?? [];
    const valueRows = rows.slice(section.valueRowStartIndex, section.valueRowStartIndex + 5);
    const gradeCodes = headerRow.slice(2).map((cell) => asText(cell));

    valueRows.forEach((row) => {
      const leaseTermMonths = asNumber(row[1]);
      if (!leaseTermMonths) {
        return;
      }

      gradeCodes.forEach((gradeCode, gradeIndex) => {
        const residualRate = asNumber(row[gradeIndex + 2]);
        if (!gradeCode || residualRate == null) {
          return;
        }

        matrixRows.push({
          matrixGroup: section.title,
          gradeCode,
          leaseTermMonths,
          residualRate,
        });
      });
    });
  }

  return matrixRows;
}

function parseBrandRatePolicies(sheet: XLSX.WorkSheet | undefined): BrandRatePolicy[] {
  if (!sheet) {
    return [];
  }

  const policies: BrandRatePolicy[] = [];

  for (let excelRow = 9; excelRow <= 33; excelRow += 1) {
    const brand = asText(readCell(sheet, `E${excelRow}`));
    if (!brand) {
      continue;
    }

    const rateMappings: Array<{
      productType: BrandRatePolicy["productType"];
      ownershipType: BrandRatePolicy["ownershipType"];
      rate: number | null;
    }> = [
      { productType: "operating_lease", ownershipType: "company", rate: asNumber(readCell(sheet, `F${excelRow}`)) },
      { productType: "operating_lease", ownershipType: "customer", rate: asNumber(readCell(sheet, `G${excelRow}`)) },
      { productType: "financial_lease", ownershipType: "company", rate: asNumber(readCell(sheet, `H${excelRow}`)) },
      { productType: "financial_lease", ownershipType: "customer", rate: asNumber(readCell(sheet, `I${excelRow}`)) },
      { productType: "installment_loan", ownershipType: "customer", rate: asNumber(readCell(sheet, `J${excelRow}`)) },
    ];

    for (const mapping of rateMappings) {
      if (mapping.rate == null) {
        continue;
      }

      policies.push({
        brand,
        productType: mapping.productType,
        ownershipType: mapping.ownershipType,
        baseIrrRate: mapping.rate,
      });
    }
  }

  return policies;
}

export function parseMgWorkbook(
  input: ArrayBuffer,
  options: MgWorkbookParseOptions,
): WorkbookPreview {
  const workbook = XLSX.read(input, {
    type: "array",
    cellFormula: true,
    cellNF: false,
    cellText: false,
  });

  const vehicleRows = sheetToRows(workbook, "차량DB");
  const residualRows = sheetToRows(workbook, "잔가map");
  const adminSheet = workbook.Sheets["견적관리자용"];

  const missingSheets = REQUIRED_SHEETS.filter((sheetName) => !workbook.Sheets[sheetName]);
  if (missingSheets.length > 0) {
    throw new Error(`Required workbook sheets are missing: ${missingSheets.join(", ")}`);
  }

  const vehiclePrograms = parseVehiclePrograms(vehicleRows);
  const residualMatrixRows = parseResidualMatrix(residualRows);
  const brandRatePolicies = parseBrandRatePolicies(adminSheet);

  return {
    lenderCode: options.lenderCode,
    lenderName: "MG Capital",
    sourceFileName: options.fileName,
    detectedVersionLabel: options.fileName.replace(/\.xlsx$/i, ""),
    sheetNames: workbook.SheetNames,
    analysis: {
      hasVehicleDb: vehicleRows.length > 0,
      hasResidualMap: residualRows.length > 0,
      hasBrandRatePolicies: Boolean(adminSheet),
      vehicleProgramCount: vehiclePrograms.length,
      residualMatrixRowCount: residualMatrixRows.length,
      brandRatePolicyCount: brandRatePolicies.length,
    },
    vehiclePrograms,
    residualMatrixRows,
    brandRatePolicies,
  };
}
