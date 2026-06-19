ALTER TABLE dape_plans ADD COLUMN IF NOT EXISTS allowed_ia_models JSONB DEFAULT '[]'::jsonb;
