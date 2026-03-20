import type { WorkbookPreview } from "@/domain/imports/types";

export type ParseWorkbookOptions = {
  lenderCode: string;
  fileName: string;
};

export interface LenderWorkbookAdapter {
  lenderCode: string;
  lenderName: string;
  parseWorkbook(input: ArrayBuffer, options: ParseWorkbookOptions): WorkbookPreview;
}
