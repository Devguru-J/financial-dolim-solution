import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { persistWorkbookImport } from "@/domain/imports/import-service";
import { getLenderAdapter } from "@/domain/imports/lender-registry";

type Bindings = Env;

const previewQuerySchema = z.object({
  lenderCode: z.string().min(1).default("mg-capital"),
});

export const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.json({
    service: "mg-lease-web",
    status: "ok",
    message: "Upload monthly lender workbooks and normalize quote data for the web calculator.",
  });
});

app.get("/health", (c) => {
  return c.json({
    ok: true,
    env: c.env.APP_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/lenders", (c) => {
  return c.json({
    ok: true,
    lenders: [
      {
        lenderCode: "mg-capital",
        lenderName: "MG Capital",
        status: "active-development",
      },
    ],
  });
});

app.post("/api/imports/preview", zValidator("query", previewQuerySchema), async (c) => {
  const formData = await c.req.formData();
  const workbookFile = formData.get("file");

  if (!(workbookFile instanceof File)) {
    return c.json(
      {
        ok: false,
        error: "Expected multipart field `file`.",
      },
      400,
    );
  }

  const arrayBuffer = await workbookFile.arrayBuffer();
  const lenderCode = c.req.valid("query").lenderCode;
  const adapter = getLenderAdapter(lenderCode);
  const workbook = adapter.parseWorkbook(arrayBuffer, {
    lenderCode,
    fileName: workbookFile.name,
  });

  return c.json({
    ok: true,
    workbook,
  });
});

app.post("/api/imports", zValidator("query", previewQuerySchema), async (c) => {
  const formData = await c.req.formData();
  const workbookFile = formData.get("file");
  const activateValue = formData.get("activate");

  if (!(workbookFile instanceof File)) {
    return c.json(
      {
        ok: false,
        error: "Expected multipart field `file`.",
      },
      400,
    );
  }

  const lenderCode = c.req.valid("query").lenderCode;
  const adapter = getLenderAdapter(lenderCode);
  const arrayBuffer = await workbookFile.arrayBuffer();
  const workbook = adapter.parseWorkbook(arrayBuffer, {
    lenderCode,
    fileName: workbookFile.name,
  });

  const importResult = await persistWorkbookImport({
    databaseUrl: c.env.DATABASE_URL,
    workbook,
    fileBuffer: arrayBuffer,
    activate: String(activateValue ?? "true").toLowerCase() !== "false",
  });

  return c.json({
    ok: true,
    workbook,
    import: importResult,
  });
});
