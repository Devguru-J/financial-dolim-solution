CREATE TYPE "public"."quote_product_type" AS ENUM('operating_lease', 'financial_lease', 'installment_loan');--> statement-breakpoint
CREATE TYPE "public"."workbook_import_status" AS ENUM('previewed', 'validated', 'activated');--> statement-breakpoint
CREATE TABLE "brand_rate_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_import_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"product_type" "quote_product_type" NOT NULL,
	"ownership_type" text NOT NULL,
	"base_irr_rate" numeric(7, 4),
	"affiliate_fee_mode" text,
	"affiliate_fee_rate" numeric(7, 4),
	"extra_cost_mode" text,
	"extra_cost_value" numeric(14, 0),
	"raw_policy" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_code" text NOT NULL,
	"product_type" "quote_product_type" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lenders" (
	"code" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_import_id" uuid NOT NULL,
	"product_type" "quote_product_type" NOT NULL,
	"customer_name" text,
	"brand" text NOT NULL,
	"model_name" text NOT NULL,
	"quote_input" jsonb NOT NULL,
	"quote_output" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "residual_matrix_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_import_id" uuid NOT NULL,
	"matrix_group" text NOT NULL,
	"grade_code" text NOT NULL,
	"lease_term_months" integer NOT NULL,
	"residual_rate" numeric(7, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_import_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model_name" text NOT NULL,
	"engine_displacement_cc" integer,
	"vehicle_class" text,
	"vehicle_price" numeric(14, 0) NOT NULL,
	"term_12_residual" numeric(7, 4),
	"term_24_residual" numeric(7, 4),
	"term_36_residual" numeric(7, 4),
	"term_48_residual" numeric(7, 4),
	"term_60_residual" numeric(7, 4),
	"high_residual_allowed" boolean,
	"hybrid_allowed" boolean,
	"residual_promotion_code" text,
	"snk_residual_band" text,
	"raw_row" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_code" text NOT NULL,
	"lender_name" text NOT NULL,
	"version_label" text NOT NULL,
	"source_file_name" text NOT NULL,
	"file_checksum" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"status" "workbook_import_status" DEFAULT 'previewed' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_rate_policies" ADD CONSTRAINT "brand_rate_policies_workbook_import_id_workbook_imports_id_fk" FOREIGN KEY ("workbook_import_id") REFERENCES "public"."workbook_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_products" ADD CONSTRAINT "lender_products_lender_code_lenders_code_fk" FOREIGN KEY ("lender_code") REFERENCES "public"."lenders"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ADD CONSTRAINT "quote_snapshots_workbook_import_id_workbook_imports_id_fk" FOREIGN KEY ("workbook_import_id") REFERENCES "public"."workbook_imports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residual_matrix_rows" ADD CONSTRAINT "residual_matrix_rows_workbook_import_id_workbook_imports_id_fk" FOREIGN KEY ("workbook_import_id") REFERENCES "public"."workbook_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_programs" ADD CONSTRAINT "vehicle_programs_workbook_import_id_workbook_imports_id_fk" FOREIGN KEY ("workbook_import_id") REFERENCES "public"."workbook_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_imports" ADD CONSTRAINT "workbook_imports_lender_code_lenders_code_fk" FOREIGN KEY ("lender_code") REFERENCES "public"."lenders"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lender_products_unique" ON "lender_products" USING btree ("lender_code","product_type");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_programs_workbook_model_unique" ON "vehicle_programs" USING btree ("workbook_import_id","brand","model_name");