import type { LenderWorkbookAdapter } from "@/domain/imports/lender-adapter";
import { parseBnkWorkbook } from "./workbook-parser";

export const bnkCapitalAdapter: LenderWorkbookAdapter = {
  lenderCode: "bnk-capital",
  lenderName: "BNK Capital",
  parseWorkbook: parseBnkWorkbook,
};
