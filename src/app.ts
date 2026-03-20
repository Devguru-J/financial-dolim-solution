import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { parseMgWorkbook } from "@/lib/excel/mg-workbook";

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
  const workbook = parseMgWorkbook(arrayBuffer, {
    lenderCode: c.req.valid("query").lenderCode,
    fileName: workbookFile.name,
  });

  return c.json({
    ok: true,
    workbook,
  });
});
