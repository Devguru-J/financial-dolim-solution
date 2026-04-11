CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"display_name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"country_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
CREATE TABLE "lender_vehicle_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_import_id" uuid NOT NULL,
	"lender_code" text NOT NULL,
	"trim_id" uuid NOT NULL,
	"lender_model_name" text NOT NULL,
	"vehicle_price" numeric(14, 0) NOT NULL,
	"term_12_residual" numeric(7, 4),
	"term_24_residual" numeric(7, 4),
	"term_36_residual" numeric(7, 4),
	"term_48_residual" numeric(7, 4),
	"term_60_residual" numeric(7, 4),
	"snk_residual_band" text,
	"aps_residual_band" text,
	"residual_promotion_code" text,
	"ws_grade" text,
	"cb_grade" text,
	"ty_grade" text,
	"jy_grade" text,
	"cr_grade" text,
	"adb_grade" text,
	"hybrid_allowed" boolean,
	"raw_row" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"vehicle_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_trims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"vehicle_key" text NOT NULL,
	"engine_displacement_cc" integer,
	"fuel_type" text,
	"is_high_residual_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_trims_vehicle_key_unique" UNIQUE("vehicle_key")
);
--> statement-breakpoint
ALTER TABLE "lender_vehicle_offerings" ADD CONSTRAINT "lender_vehicle_offerings_workbook_import_id_workbook_imports_id_fk" FOREIGN KEY ("workbook_import_id") REFERENCES "public"."workbook_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_vehicle_offerings" ADD CONSTRAINT "lender_vehicle_offerings_lender_code_lenders_code_fk" FOREIGN KEY ("lender_code") REFERENCES "public"."lenders"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_vehicle_offerings" ADD CONSTRAINT "lender_vehicle_offerings_trim_id_vehicle_trims_id_fk" FOREIGN KEY ("trim_id") REFERENCES "public"."vehicle_trims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_trims" ADD CONSTRAINT "vehicle_trims_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lender_vehicle_offerings_unique" ON "lender_vehicle_offerings" USING btree ("workbook_import_id","trim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_brand_canonical_unique" ON "vehicle_models" USING btree ("brand_id","canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_trims_model_canonical_unique" ON "vehicle_trims" USING btree ("model_id","canonical_name");