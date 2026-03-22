import { desc, eq } from "drizzle-orm";

import { workbookImports } from "@/db/schema";
import { createDbClient } from "@/lib/db/client";

export async function listWorkbookImports(params: {
  databaseUrl?: string;
  lenderCode?: string;
}): Promise<
  | {
      connected: false;
      imports: [];
    }
  | {
      connected: true;
      imports: Array<{
        id: string;
        lenderCode: string;
        lenderName: string;
        versionLabel: string;
        sourceFileName: string;
        importedAt: Date;
        isActive: boolean;
        status: string;
        meta: Record<string, unknown>;
      }>;
    }
> {
  const { databaseUrl, lenderCode } = params;

  if (!databaseUrl) {
    return {
      connected: false,
      imports: [],
    };
  }

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    const rows = lenderCode
      ? await db
          .select()
          .from(workbookImports)
          .where(eq(workbookImports.lenderCode, lenderCode))
          .orderBy(desc(workbookImports.importedAt))
      : await db.select().from(workbookImports).orderBy(desc(workbookImports.importedAt));

    return {
      connected: true,
      imports: rows.map((row) => ({
        id: row.id,
        lenderCode: row.lenderCode,
        lenderName: row.lenderName,
        versionLabel: row.versionLabel,
        sourceFileName: row.sourceFileName,
        importedAt: row.importedAt,
        isActive: row.isActive,
        status: row.status,
        meta: row.meta,
      })),
    };
  } finally {
    await dispose();
  }
}

export async function getActiveWorkbookSheetContracts(params: {
  databaseUrl?: string;
  lenderCode: string;
}): Promise<{
  connected: boolean;
  workbookImport: null | {
    id: string;
    versionLabel: string;
    sourceFileName: string;
  };
  sheetContracts: Record<string, unknown> | null;
}> {
  const { databaseUrl, lenderCode } = params;

  if (!databaseUrl) {
    return {
      connected: false,
      workbookImport: null,
      sheetContracts: null,
    };
  }

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    const [row] = await db
      .select()
      .from(workbookImports)
      .where(eq(workbookImports.lenderCode, lenderCode))
      .orderBy(desc(workbookImports.isActive), desc(workbookImports.importedAt));

    if (!row) {
      return {
        connected: true,
        workbookImport: null,
        sheetContracts: null,
      };
    }

    return {
      connected: true,
      workbookImport: {
        id: row.id,
        versionLabel: row.versionLabel,
        sourceFileName: row.sourceFileName,
      },
      sheetContracts:
        row.meta && typeof row.meta === "object" && row.meta !== null
          ? ((row.meta as Record<string, unknown>).sheetContracts as Record<string, unknown> | null | undefined) ?? null
          : null,
    };
  } finally {
    await dispose();
  }
}
