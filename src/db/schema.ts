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

// ---------------------------------------------------------------------------
// Normalized vehicle hierarchy — brand → model → trim, with per-lender
// offerings referencing trims. Replaces denormalized `vehicle_programs`.
//
// Goals:
// - Cross-lender matching at the DB level via `vehicle_trims.vehicle_key`
// - Single source of truth for brand aliases (no more "AUDI" vs "아우디" string matching)
// - Deduplication: trim info stored once, each lender's workbook references it
// - Historic imports retain their offerings (offerings FK to workbook_import)
// ---------------------------------------------------------------------------

export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Canonical uppercase code used internally ("AUDI", "BMW", "BENZ", "PORSCHE"...)
  canonicalName: text("canonical_name").notNull().unique(),
  // Human-facing display name ("Audi", "BMW", "Mercedes-Benz"...)
  displayName: text("display_name").notNull(),
  // All known name spellings across lenders (English / Korean / legacy names)
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  // ISO country code of origin (DE, JP, US, KR, IT, GB, SE, FR, CN)
  countryCode: text("country_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vehicleModels = pgTable(
  "vehicle_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "cascade" }).notNull(),
    // Canonical model line name ("5 Series", "A7", "911", "Cayenne", "Wrangler"...)
    canonicalName: text("canonical_name").notNull(),
    // Vehicle class from workbook ("승용", "SUV", etc) — best effort, can be null
    vehicleClass: text("vehicle_class"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    brandModelUnique: uniqueIndex("vehicle_models_brand_canonical_unique").on(
      table.brandId,
      table.canonicalName,
    ),
  }),
);

export const vehicleTrims = pgTable(
  "vehicle_trims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelId: uuid("model_id").references(() => vehicleModels.id, { onDelete: "cascade" }).notNull(),
    // Distinct variant name — preserves per-lender granularity
    // (MG: "320d M Sport xDrive", BNK: "The New 3 Series 디젤 2.0 세단 320d M Sport")
    canonicalName: text("canonical_name").notNull(),
    // Cross-lender matching hint (NOT unique — multiple trims share the same key)
    // ("BMW_320D" matches all 320d variants across MG and BNK)
    vehicleKey: text("vehicle_key").notNull(),
    engineDisplacementCc: integer("engine_displacement_cc"),
    // "gasoline" | "diesel" | "electric" | "hybrid" | "phev" | "mhev"
    fuelType: text("fuel_type"),
    // Whether 고잔가 (high-residual) option is permitted for this trim
    isHighResidualEligible: boolean("is_high_residual_eligible").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    modelTrimUnique: uniqueIndex("vehicle_trims_model_canonical_unique").on(
      table.modelId,
      table.canonicalName,
    ),
  }),
);

export const lenderVehicleOfferings = pgTable(
  "lender_vehicle_offerings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workbookImportId: uuid("workbook_import_id")
      .references(() => workbookImports.id, { onDelete: "cascade" })
      .notNull(),
    lenderCode: text("lender_code")
      .references(() => lenders.code, { onDelete: "cascade" })
      .notNull(),
    trimId: uuid("trim_id").references(() => vehicleTrims.id, { onDelete: "cascade" }).notNull(),
    // Original lender-specific brand and model name preserved for debug / display
    // (MG: "AUDI" / "520i", BNK: "아우디" / "The New 5 Series 가솔린 2.0 520i")
    lenderBrand: text("lender_brand").notNull(),
    lenderModelName: text("lender_model_name").notNull(),
    vehiclePrice: numeric("vehicle_price", { precision: 14, scale: 0 }).notNull(),

    // MG Capital-specific: term-based residuals from 차량DB sheet (nullable for BNK)
    term12Residual: numeric("term_12_residual", { precision: 7, scale: 4 }),
    term24Residual: numeric("term_24_residual", { precision: 7, scale: 4 }),
    term36Residual: numeric("term_36_residual", { precision: 7, scale: 4 }),
    term48Residual: numeric("term_48_residual", { precision: 7, scale: 4 }),
    term60Residual: numeric("term_60_residual", { precision: 7, scale: 4 }),
    snkResidualBand: text("snk_residual_band"),
    apsResidualBand: text("aps_residual_band"),
    residualPromotionCode: text("residual_promotion_code"),

    // BNK Capital-specific: CDB provider grades for residual matrix lookup (nullable for MG)
    wsGrade: text("ws_grade"),
    cbGrade: text("cb_grade"),
    tyGrade: text("ty_grade"),
    jyGrade: text("jy_grade"),
    crGrade: text("cr_grade"),
    adbGrade: text("adb_grade"),

    // Common flags + escape hatch for extra data
    hybridAllowed: boolean("hybrid_allowed"),
    rawRow: jsonb("raw_row").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    offeringUnique: uniqueIndex("lender_vehicle_offerings_unique").on(
      table.workbookImportId,
      table.trimId,
    ),
  }),
);
