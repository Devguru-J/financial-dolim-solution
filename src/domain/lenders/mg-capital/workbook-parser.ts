import * as XLSX from "xlsx";

import type {
  WorkbookBrandRatePolicy,
  WorkbookPreview,
  WorkbookResidualMatrixRow,
  WorkbookSheetContracts,
  WorkbookSheetFieldSnapshot,
  WorkbookOperatingLeaseSheetContract,
  WorkbookVehicleProgram,
} from "@/domain/imports/types";
import type { ParseWorkbookOptions } from "@/domain/imports/lender-adapter";

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

function readField(sheet: XLSX.WorkSheet | undefined, address: string): WorkbookSheetFieldSnapshot {
  const cell = sheet?.[address];

  return {
    cell: address,
    value: (cell?.v as string | number | boolean | null | undefined) ?? null,
    displayText: typeof cell?.w === "string" ? cell.w : cell?.w == null ? null : String(cell.w),
    formula: typeof cell?.f === "string" ? cell.f : null,
  };
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

function parseVehiclePrograms(rows: unknown[][]): WorkbookVehicleProgram[] {
  const parsedRows: Array<WorkbookVehicleProgram | null> = rows.slice(5).map((row) => {
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
        12: asNumber(row[31]) ?? undefined,
        24: asNumber(row[32]) ?? undefined,
        36: asNumber(row[33]) ?? undefined,
        48: asNumber(row[34]) ?? undefined,
        60: asNumber(row[35]) ?? undefined,
      },
      snkResiduals: {
        12: asNumber(row[19]) ?? undefined,
        24: asNumber(row[20]) ?? undefined,
        36: asNumber(row[21]) ?? undefined,
        48: asNumber(row[22]) ?? undefined,
        60: asNumber(row[23]) ?? undefined,
      },
      apsResidualBand: asText(row[24]),
      apsResiduals: {
        12: asNumber(row[25]) ?? undefined,
        24: asNumber(row[26]) ?? undefined,
        36: asNumber(row[27]) ?? undefined,
        48: asNumber(row[28]) ?? undefined,
        60: asNumber(row[29]) ?? undefined,
      },
      chatbotResiduals: {
        12: asNumber(row[31]) ?? undefined,
        24: asNumber(row[32]) ?? undefined,
        36: asNumber(row[33]) ?? undefined,
        48: asNumber(row[34]) ?? undefined,
        60: asNumber(row[35]) ?? undefined,
      },
      highResidualAllowed: asText(row[15]) === "Y",
      hybridAllowed: asText(row[16]) === "Y" || asText(row[16]) === "E",
      residualPromotionCode: asText(row[17]),
      snkResidualBand: asText(row[18]),
      apsPromotionRate: asNumber(row[36]),
      snkPromotionRate: asNumber(row[37]),
    };
  });

  return parsedRows.filter((row): row is WorkbookVehicleProgram => row !== null);
}

function parseResidualMatrix(rows: unknown[][]): WorkbookResidualMatrixRow[] {
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

  const matrixRows: WorkbookResidualMatrixRow[] = [];

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

function parseBrandRatePolicies(sheet: XLSX.WorkSheet | undefined): WorkbookBrandRatePolicy[] {
  if (!sheet) {
    return [];
  }

  const policies: WorkbookBrandRatePolicy[] = [];

  for (let excelRow = 9; excelRow <= 33; excelRow += 1) {
    const brand = asText(readCell(sheet, `E${excelRow}`));
    if (!brand) {
      continue;
    }

    const rateMappings: Array<{
      productType: WorkbookBrandRatePolicy["productType"];
      ownershipType: WorkbookBrandRatePolicy["ownershipType"];
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

function parseOperatingLeaseSheetContract(
  sheet: XLSX.WorkSheet | undefined,
  vehiclePrograms: WorkbookVehicleProgram[],
): WorkbookOperatingLeaseSheetContract | null {
  if (!sheet) {
    return null;
  }

  const brand = asText(readCell(sheet, "BD5"));
  const modelName = asText(readCell(sheet, "BD6"));
  const actualVehiclePrice = asNumber(readCell(sheet, "BD10")) ?? asNumber(readCell(sheet, "BD9"));
  const matchedVehicleProgram =
    vehiclePrograms.find((program) => program.brand === brand && program.modelName === modelName) ?? null;
  const expectedVehiclePrice = matchedVehicleProgram?.vehiclePrice ?? null;
  const vehiclePriceMatches =
    actualVehiclePrice == null || expectedVehiclePrice == null ? false : actualVehiclePrice === expectedVehiclePrice;
  const consistencyMessage =
    matchedVehicleProgram == null
      ? "운용리스 시트의 현재 브랜드/모델이 차량DB에 존재하지 않습니다."
      : vehiclePriceMatches
        ? null
        : `운용리스 시트 저장 차량가(${actualVehiclePrice?.toLocaleString("ko-KR") ?? "-"})와 차량DB 기준값(${expectedVehiclePrice?.toLocaleString("ko-KR") ?? "-"})이 다릅니다.`;

  return {
    sheetName: "운용리스",
    consistency: {
      matchedVehicleProgram: matchedVehicleProgram != null,
      matchedBrand: matchedVehicleProgram?.brand ?? null,
      matchedModelName: matchedVehicleProgram?.modelName ?? null,
      expectedVehiclePrice,
      actualVehiclePrice,
      vehiclePriceMatches,
      message: consistencyMessage,
    },
    fields: {
      brand: readField(sheet, "BD5"),
      modelName: readField(sheet, "BD6"),
      vehicleClass: readField(sheet, "BD7"),
      engineDisplacementCc: readField(sheet, "BD8"),
      directInputVehiclePrice: readField(sheet, "BD9"),
      basicVehiclePrice: readField(sheet, "BD10"),
      optionAmount: readField(sheet, "BD11"),
      discountMode: readField(sheet, "BD12"),
      discountAmount: readField(sheet, "CE13"),
      invoiceVehiclePrice: readField(sheet, "BD14"),
      ownershipLabel: readField(sheet, "BD15"),
      publicBondRate: readField(sheet, "BD16"),
      publicBondAmount: readField(sheet, "BD17"),
      miscFeeAmount: readField(sheet, "BD18"),
      deliveryFeeAmount: readField(sheet, "BD20"),
      acquisitionTaxMode: readField(sheet, "BD19"),
      acquisitionTaxRate: readField(sheet, "CE21"),
      leaseTermMonths: readField(sheet, "BD22"),
      upfrontPaymentAmount: readField(sheet, "BD23"),
      depositMode: readField(sheet, "BD24"),
      annualMileageKm: readField(sheet, "BD26"),
      residualMode: readField(sheet, "BD27"),
      selectedResidualRate: readField(sheet, "BK27"),
      minResidualRate: readField(sheet, "BK28"),
      maxResidualRate: readField(sheet, "BK29"),
      agFeeRate: readField(sheet, "BD30"),
      cmFeeRate: readField(sheet, "BD31"),
      carTaxMode: readField(sheet, "BD32"),
      insuranceYearlyAmount: readField(sheet, "BD33"),
      lossDamageAmount: readField(sheet, "BD34"),
      extraService: readField(sheet, "BD35"),
      salesOwner: readField(sheet, "BD36"),
      appliedAnnualRate: readField(sheet, "BD37"),
    },
  };
}

export function parseMgWorkbook(input: ArrayBuffer, options: ParseWorkbookOptions): WorkbookPreview {
  const workbook = XLSX.read(input, {
    type: "array",
    cellFormula: true,
    cellNF: false,
    cellText: false,
  });

  const vehicleRows = sheetToRows(workbook, "차량DB");
  const residualRows = sheetToRows(workbook, "잔가map");
  const adminSheet = workbook.Sheets["견적관리자용"];
  const operatingLeaseSheet = workbook.Sheets["운용리스"];

  const missingSheets = REQUIRED_SHEETS.filter((sheetName) => !workbook.Sheets[sheetName]);
  if (missingSheets.length > 0) {
    throw new Error(`Required workbook sheets are missing: ${missingSheets.join(", ")}`);
  }

  const vehiclePrograms = parseVehiclePrograms(vehicleRows);
  const residualMatrixRows = parseResidualMatrix(residualRows);
  const brandRatePolicies = parseBrandRatePolicies(adminSheet);
  const sheetContracts: WorkbookSheetContracts = {
    operatingLease: parseOperatingLeaseSheetContract(operatingLeaseSheet, vehiclePrograms),
  };

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
    sheetContracts,
  };
}
