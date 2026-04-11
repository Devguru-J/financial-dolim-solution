-- Enable Row Level Security on all public tables exposed via Supabase PostgREST.
-- No policies are defined, so anon/authenticated roles are fully blocked.
-- The backend connects via DATABASE_URL as a privileged role and bypasses RLS.

ALTER TABLE "lenders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lender_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workbook_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_trims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lender_vehicle_offerings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "residual_matrix_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_rate_policies" ENABLE ROW LEVEL SECURITY;
