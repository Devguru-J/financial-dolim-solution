import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { persistWorkbookImport } from "@/domain/imports/import-service";
import { listWorkbookImports } from "@/domain/imports/import-queries";
import { getLenderAdapter } from "@/domain/imports/lender-registry";
import { calculateMgOperatingLeaseQuote } from "@/domain/lenders/mg-capital/operating-lease-service";
import { renderPlaygroundHtml } from "@/playground";

type Bindings = Env;

const previewQuerySchema = z.object({
  lenderCode: z.string().min(1).default("mg-capital"),
});

const calculateQuoteSchema = z.object({
  lenderCode: z.string().min(1).default("mg-capital"),
  productType: z.literal("operating_lease").default("operating_lease"),
  brand: z.string().min(1),
  modelName: z.string().min(1),
  ownershipType: z.enum(["company", "customer"]),
  leaseTermMonths: z.union([z.literal(12), z.literal(24), z.literal(36), z.literal(48), z.literal(60)]),
  annualMileageKm: z.union([z.literal(10000), z.literal(20000), z.literal(30000), z.literal(35000)]).optional(),
  upfrontPayment: z.number().min(0).default(0),
  depositAmount: z.number().min(0).optional(),
  quotedVehiclePrice: z.number().positive().optional(),
  discountAmount: z.number().min(0).optional(),
  annualIrrRateOverride: z.number().positive().optional(),
  annualEffectiveRateOverride: z.number().positive().optional(),
  paymentRateOverride: z.number().positive().optional(),
  residualRateOverride: z.number().positive().optional(),
  selectedResidualRateOverride: z.number().positive().optional(),
  residualMatrixGroup: z.string().min(1).optional(),
  residualValueMode: z.enum(["vehicle-price-ratio", "acquisition-cost-ratio", "amount"]).optional(),
  residualValueRatio: z.number().min(0).optional(),
  residualAmountOverride: z.number().min(0).optional(),
  acquisitionTaxRateOverride: z.number().min(0).max(1).optional(),
  publicBondCost: z.number().min(0).optional(),
  stampDuty: z.number().min(0).optional(),
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

app.get("/playground", (c) => {
  return c.html(renderPlaygroundHtml());
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

app.get("/api/imports", zValidator("query", previewQuerySchema), async (c) => {
  const lenderCode = c.req.valid("query").lenderCode;
  const result = await listWorkbookImports({
    databaseUrl: c.env.DATABASE_URL,
    lenderCode,
  });

  return c.json({
    ok: true,
    ...result,
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

app.post("/api/quotes/calculate", zValidator("json", calculateQuoteSchema), async (c) => {
  const input = c.req.valid("json");

  try {
    const quote = await calculateMgOperatingLeaseQuote({
      databaseUrl: c.env.DATABASE_URL,
      input,
    });

    return c.json({
      ok: true,
      quote,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to calculate quote.",
      },
      400,
    );
  }
});
