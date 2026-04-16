import type { LenderWorkbookAdapter } from "@/domain/imports/lender-adapter";
import { parseWooriWorkbook } from "./workbook-parser";

export const wooriCardAdapter: LenderWorkbookAdapter = {
  lenderCode: "woori-card",
  lenderName: "우리카드",
  parseWorkbook: parseWooriWorkbook,
};
