import type { LenderWorkbookAdapter } from "@/domain/imports/lender-adapter";
import { parseMgWorkbook } from "@/domain/lenders/mg-capital/workbook-parser";

export const mgCapitalAdapter: LenderWorkbookAdapter = {
  lenderCode: "mg-capital",
  lenderName: "MG Capital",
  parseWorkbook: parseMgWorkbook,
};
