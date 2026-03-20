import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const quoteProductType = pgEnum("quote_product_type", [
  "operating_lease",
  "financial_lease",
  "installment_loan",
]);

export const workbookImportStatus = pgEnum("workbook_import_status", [
  "previewed",
  "validated",
  "activated",
]);

export const lenders = pgTable("lenders", {
  code: text("code").primaryKey(),
  displayName: text("display_name").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lenderProducts = pgTable(
  "lender_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lenderCode: text("lender_code")
      .references(() => lenders.code, { onDelete: "cascade" })
      .notNull(),
    productType: quoteProductType("product_type").notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
  },
  (table) => ({
    lenderProductUnique: uniqueIndex("lender_products_unique").on(table.lenderCode, table.productType),
  }),
);

export const workbookImports = pgTable("workbook_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  lenderCode: text("lender_code")
    .references(() => lenders.code, { onDelete: "restrict" })
    .notNull(),
  lenderName: text("lender_name").notNull(),
  versionLabel: text("version_label").notNull(),
  sourceFileName: text("source_file_name").notNull(),
  fileChecksum: text("file_checksum"),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  status: workbookImportStatus("status").default("previewed").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
});

export const vehiclePrograms = pgTable(
  "vehicle_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workbookImportId: uuid("workbook_import_id")
      .references(() => workbookImports.id, { onDelete: "cascade" })
      .notNull(),
    brand: text("brand").notNull(),
    modelName: text("model_name").notNull(),
    engineDisplacementCc: integer("engine_displacement_cc"),
    vehicleClass: text("vehicle_class"),
    vehiclePrice: numeric("vehicle_price", { precision: 14, scale: 0 }).notNull(),
    term12Residual: numeric("term_12_residual", { precision: 7, scale: 4 }),
    term24Residual: numeric("term_24_residual", { precision: 7, scale: 4 }),
    term36Residual: numeric("term_36_residual", { precision: 7, scale: 4 }),
    term48Residual: numeric("term_48_residual", { precision: 7, scale: 4 }),
    term60Residual: numeric("term_60_residual", { precision: 7, scale: 4 }),
    highResidualAllowed: boolean("high_residual_allowed"),
    hybridAllowed: boolean("hybrid_allowed"),
    residualPromotionCode: text("residual_promotion_code"),
    snkResidualBand: text("snk_residual_band"),
    rawRow: jsonb("raw_row").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    workbookModelUnique: uniqueIndex("vehicle_programs_workbook_model_unique").on(
      table.workbookImportId,
      table.brand,
      table.modelName,
    ),
  }),
);

export const residualMatrixRows = pgTable("residual_matrix_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  workbookImportId: uuid("workbook_import_id")
    .references(() => workbookImports.id, { onDelete: "cascade" })
    .notNull(),
  matrixGroup: text("matrix_group").notNull(),
  gradeCode: text("grade_code").notNull(),
  leaseTermMonths: integer("lease_term_months").notNull(),
  residualRate: numeric("residual_rate", { precision: 7, scale: 4 }).notNull(),
});

export const brandRatePolicies = pgTable("brand_rate_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  workbookImportId: uuid("workbook_import_id")
    .references(() => workbookImports.id, { onDelete: "cascade" })
    .notNull(),
  brand: text("brand").notNull(),
  productType: quoteProductType("product_type").notNull(),
  ownershipType: text("ownership_type").notNull(),
  baseIrrRate: numeric("base_irr_rate", { precision: 7, scale: 4 }),
  affiliateFeeMode: text("affiliate_fee_mode"),
  affiliateFeeRate: numeric("affiliate_fee_rate", { precision: 7, scale: 4 }),
  extraCostMode: text("extra_cost_mode"),
  extraCostValue: numeric("extra_cost_value", { precision: 14, scale: 0 }),
  rawPolicy: jsonb("raw_policy").$type<Record<string, unknown>>().notNull().default({}),
});

export const quoteSnapshots = pgTable("quote_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  workbookImportId: uuid("workbook_import_id")
    .references(() => workbookImports.id, { onDelete: "restrict" })
    .notNull(),
  productType: quoteProductType("product_type").notNull(),
  customerName: text("customer_name"),
  brand: text("brand").notNull(),
  modelName: text("model_name").notNull(),
  quoteInput: jsonb("quote_input").$type<Record<string, unknown>>().notNull(),
  quoteOutput: jsonb("quote_output").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
