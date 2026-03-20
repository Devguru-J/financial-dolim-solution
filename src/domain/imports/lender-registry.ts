import type { LenderWorkbookAdapter } from "@/domain/imports/lender-adapter";
import { mgCapitalAdapter } from "@/domain/lenders/mg-capital/adapter";

const lenders = new Map<string, LenderWorkbookAdapter>([[mgCapitalAdapter.lenderCode, mgCapitalAdapter]]);

export function getLenderAdapter(lenderCode: string): LenderWorkbookAdapter {
  const adapter = lenders.get(lenderCode);
  if (!adapter) {
    throw new Error(`Unsupported lender code: ${lenderCode}`);
  }

  return adapter;
}
