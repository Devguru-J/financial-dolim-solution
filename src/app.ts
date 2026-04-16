import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { persistWorkbookImport } from "@/domain/imports/import-service";
import { getActiveWorkbookSheetContracts, listWorkbookImports } from "@/domain/imports/import-queries";
import { getActiveWorkbookBrands, getActiveWorkbookModels, getBnkDealersForBrand } from "@/domain/imports/catalog-queries";
import { getLenderAdapter } from "@/domain/imports/lender-registry";
import { calculateMgOperatingLeaseQuote } from "@/domain/lenders/mg-capital/operating-lease-service";
import { calculateBnkOperatingLeaseQuote } from "@/domain/lenders/bnk-capital/operating-lease-service";
import { calculateWooriOperatingLeaseQuote } from "@/domain/lenders/woori-card/operating-lease-service";
import { createDbClient } from "@/lib/db/client";

type Bindings = Env;

const previewQuerySchema = z.object({
  lenderCode: z.string().min(1).default("mg-capital"),
});

const catalogQuerySchema = z.object({
  lenderCode: z.string().min(1).optional(),
});

const catalogModelsQuerySchema = z.object({
  lenderCode: z.string().min(1).optional(),
  brand: z.string().min(1),
});

const calculateQuoteSchema = z.object({
  lenderCode: z.string().min(1).default("mg-capital"),
  productType: z.literal("operating_lease").default("operating_lease"),
  brand: z.string().min(1),
  modelName: z.string().min(1),
  affiliateType: z.enum(["비제휴사", "KCC오토", "KCC면제"]).optional(),
  directModelEntry: z.boolean().optional(),
  manualVehicleClass: z.string().min(1).optional(),
  manualEngineDisplacementCc: z.number().positive().optional(),
  ownershipType: z.enum(["company", "customer"]),
  leaseTermMonths: z.union([z.literal(12), z.literal(24), z.literal(36), z.literal(48), z.literal(60)]),
  annualMileageKm: z.union([z.literal(10000), z.literal(15000), z.literal(20000), z.literal(25000), z.literal(30000), z.literal(35000), z.literal(40000)]).optional(),
  upfrontPayment: z.number().min(0).default(0),
  depositAmount: z.number().min(0).optional(),
  quotedVehiclePrice: z.number().positive().optional(),
  discountAmount: z.number().min(0).optional(),
  annualIrrRateOverride: z.number().positive().optional(),
  annualEffectiveRateOverride: z.number().positive().optional(),
  paymentRateOverride: z.number().positive().optional(),
  residualMode: z.enum(["high", "standard"]).optional(),
  residualRateOverride: z.number().positive().optional(),
  selectedResidualRateOverride: z.number().positive().optional(),
  residualMatrixGroup: z.string().min(1).optional(),
  residualValueMode: z.enum(["vehicle-price-ratio", "acquisition-cost-ratio", "amount"]).optional(),
  residualValueRatio: z.number().min(0).optional(),
  residualAmountOverride: z.number().min(0).optional(),
  acquisitionTaxMode: z.enum(["automatic", "ratio", "reduction", "amount"]).optional(),
  acquisitionTaxRateOverride: z.number().min(0).max(1).optional(),
  acquisitionTaxRatioInput: z.number().min(0).max(1).optional(),
  acquisitionTaxReduction: z.number().min(0).optional(),
  acquisitionTaxAmountOverride: z.number().min(0).optional(),
  includePublicBondCost: z.boolean().optional(),
  publicBondCost: z.number().min(0).optional(),
  includeMiscFeeAmount: z.boolean().optional(),
  miscFeeAmount: z.number().min(0).optional(),
  includeDeliveryFeeAmount: z.boolean().optional(),
  deliveryFeeAmount: z.number().min(0).optional(),
  evSubsidyAmount: z.number().min(0).optional(),
  stampDuty: z.number().min(0).optional(),
  agFeeRate: z.number().min(0).optional(),
  cmFeeRate: z.number().min(0).optional(),
  insuranceYearlyAmount: z.number().min(0).optional(),
  lossDamageAmount: z.number().min(0).optional(),
  bnkDealerName: z.string().min(1).optional(),
});

export const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    env: c.env.APP_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/apple-touch-icon.png", (c) => c.body(null, 204));
app.get("/apple-touch-icon-precomposed.png", (c) => c.body(null, 204));


app.get("/api/health", async (c) => {
  try {
    const dbUrl = c.env.DATABASE_URL;
    if (!dbUrl) return c.json({ ok: false, error: "DATABASE_URL not set" });
    const { db, dispose } = createDbClient(dbUrl);
    try {
      const result = await db.execute("SELECT 1 as test");
      return c.json({ ok: true, db: "connected" });
    } catch (dbErr) {
      return c.json({ ok: false, error: "query_failed", detail: String(dbErr), urlLen: dbUrl.length });
    } finally {
      await dispose();
    }
  } catch (e) {
    return c.json({ ok: false, error: "init_failed", detail: String(e) });
  }
});

app.get("/api/lenders", (c) => {
  return c.json({
    ok: true,
    lenders: [
      {
        lenderCode: "mg-capital",
        lenderName: "MG캐피탈",
        status: "active-development",
      },
      {
        lenderCode: "bnk-capital",
        lenderName: "BNK캐피탈",
        status: "active-development",
      },
      {
        lenderCode: "woori-card",
        lenderName: "우리카드",
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

app.get("/api/workbook-contract", zValidator("query", previewQuerySchema), async (c) => {
  const lenderCode = c.req.valid("query").lenderCode;
  const result = await getActiveWorkbookSheetContracts({
    databaseUrl: c.env.DATABASE_URL,
    lenderCode,
  });

  return c.json({
    ok: true,
    ...result,
  });
});

app.get("/api/catalog/brands", zValidator("query", catalogQuerySchema), async (c) => {
  const lenderCode = c.req.valid("query").lenderCode;
  const result = await getActiveWorkbookBrands({
    databaseUrl: c.env.DATABASE_URL,
    lenderCode,
  });

  return c.json({
    ok: true,
    ...result,
  });
});

app.get("/api/catalog/models", zValidator("query", catalogModelsQuerySchema), async (c) => {
  const { lenderCode, brand } = c.req.valid("query");
  const result = await getActiveWorkbookModels({
    databaseUrl: c.env.DATABASE_URL,
    lenderCode,
    brand,
  });

  return c.json({
    ok: true,
    ...result,
  });
});

const catalogDealersQuerySchema = z.object({
  brand: z.string().min(1),
});

app.get("/api/catalog/bnk-dealers", zValidator("query", catalogDealersQuerySchema), async (c) => {
  const { brand } = c.req.valid("query");
  const result = await getBnkDealersForBrand({ databaseUrl: c.env.DATABASE_URL, brand });
  return c.json({ ok: true, ...result });
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
    let quote;
    if (input.lenderCode === "bnk-capital") {
      quote = await calculateBnkOperatingLeaseQuote({ databaseUrl: c.env.DATABASE_URL, input });
    } else if (input.lenderCode === "woori-card") {
      quote = await calculateWooriOperatingLeaseQuote({ databaseUrl: c.env.DATABASE_URL, input });
    } else {
      quote = await calculateMgOperatingLeaseQuote({ databaseUrl: c.env.DATABASE_URL, input });
    }

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

