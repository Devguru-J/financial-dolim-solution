import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  brandRatePolicies,
  lenderProducts,
  lenders,
  residualMatrixRows,
  workbookImports,
} from "@/db/schema";
import { populateNormalizedTablesForImport } from "@/domain/imports/normalize-to-offerings";
import type { PersistWorkbookImportResult, WorkbookPreview } from "@/domain/imports/types";
import { createDbClient } from "@/lib/db/client";

function computeChecksum(input: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(input)).digest("hex");
}

export async function persistWorkbookImport(params: {
  databaseUrl?: string;
  workbook: WorkbookPreview;
  fileBuffer: ArrayBuffer;
  activate?: boolean;
}): Promise<PersistWorkbookImportResult> {
  const { databaseUrl, workbook, fileBuffer, activate = true } = params;

  if (!databaseUrl) {
    return {
      id: null,
      lenderCode: workbook.lenderCode,
      versionLabel: workbook.detectedVersionLabel,
      persisted: false,
      persistenceMode: "skipped",
      analysis: workbook.analysis,
    };
  }

  const { db, dispose } = createDbClient(databaseUrl);
  const checksum = computeChecksum(fileBuffer);

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(lenders)
        .values({
          code: workbook.lenderCode,
          displayName: workbook.lenderName,
        })
        .onConflictDoNothing();

      await tx
        .insert(lenderProducts)
        .values([
          { lenderCode: workbook.lenderCode, productType: "operating_lease" },
          { lenderCode: workbook.lenderCode, productType: "financial_lease" },
          { lenderCode: workbook.lenderCode, productType: "installment_loan" },
        ])
        .onConflictDoNothing();

      if (activate) {
        await tx
          .update(workbookImports)
          .set({ isActive: false })
          .where(eq(workbookImports.lenderCode, workbook.lenderCode));
      }

      const [createdImport] = await tx
        .insert(workbookImports)
        .values({
          lenderCode: workbook.lenderCode,
          lenderName: workbook.lenderName,
          versionLabel: workbook.detectedVersionLabel,
          sourceFileName: workbook.sourceFileName,
          fileChecksum: checksum,
          isActive: activate,
          status: activate ? "activated" : "validated",
          meta: {
            sheetNames: workbook.sheetNames,
            analysis: workbook.analysis,
            sheetContracts: workbook.sheetContracts,
          },
        })
        .returning({ id: workbookImports.id });

      const workbookImportId = createdImport.id;

      if (workbook.residualMatrixRows.length > 0) {
        await tx.insert(residualMatrixRows).values(
          workbook.residualMatrixRows.map((row) => ({
            workbookImportId,
            matrixGroup: row.matrixGroup,
            gradeCode: row.gradeCode,
            leaseTermMonths: row.leaseTermMonths,
            residualRate: row.residualRate.toFixed(4),
          })),
        );
      }

      if (workbook.brandRatePolicies.length > 0) {
        await tx.insert(brandRatePolicies).values(
          workbook.brandRatePolicies.map((policy) => ({
            workbookImportId,
            brand: policy.brand,
            productType: policy.productType,
            ownershipType: policy.ownershipType,
            baseIrrRate: policy.baseIrrRate.toFixed(4),
            rawPolicy: policy.dealerName ? { dealerName: policy.dealerName } : {},
          })),
        );
      }

      // Populate normalized schema (brands/models/trims/offerings) so engine
      // queries can use the new join path for this import immediately.
      await populateNormalizedTablesForImport(tx, {
        workbookImportId,
        lenderCode: workbook.lenderCode,
        workbook,
      });

      return workbookImportId;
    });

    return {
      id: result,
      lenderCode: workbook.lenderCode,
      versionLabel: workbook.detectedVersionLabel,
      persisted: true,
      persistenceMode: "database",
      analysis: workbook.analysis,
    };
  } finally {
    await dispose();
  }
}
