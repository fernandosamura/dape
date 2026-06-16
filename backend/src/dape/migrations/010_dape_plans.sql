-- =============================================
-- DAPE Plans: Sistema de Planos e Módulos
-- Migration: 010
-- IMPORTANTE: executar ANTES das migrations 001-006
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS dape_available_modules (
  id SERIAL PRIMARY KEY,
  module_key VARCHAR(50) UNIQUE NOT NULL,
  module_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO dape_available_modules (module_key, module_name, description, icon, sort_order) VALUES
  ('dape_pipeline',     'DAPE Pipeline',     'Lead Score, temperatura e probabilidade de fechamento', 'kanban',       1),
  ('dape_analytics',    'DAPE Analytics',    'Dashboard executivo com KPIs, receita e conversão',     'chart-bar',    2),
  ('dape_ia',           'DAPE IA',           'Resumos automáticos e sugestões por inteligência artificial', 'robot',   3),
  ('dape_growth',       'DAPE Growth',       'Planejamento de campanhas, metas e indicadores',        'trending-up',  4),
  ('dape_intelligence', 'DAPE Intelligence', 'Score e diagnóstico de empresas e oportunidades',       'brain',        5),
  ('dape_radar',        'DAPE Radar',        'Captação automática de oportunidades externas',         'radar',        6)
ON CONFLICT (module_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS dape_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  is_master BOOLEAN DEFAULT FALSE,
  max_users INTEGER DEFAULT 5,
  max_contacts INTEGER DEFAULT 1000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dape_plan_modules (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES dape_plans(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan_id, module_key)
);

CREATE TABLE IF NOT EXISTS dape_tenant_plans (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE,
  plan_id INTEGER REFERENCES dape_plans(id),
  is_master BOOLEAN DEFAULT FALSE,
  plan_starts_at DATE DEFAULT CURRENT_DATE,
  plan_ends_at DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dape_tenant_module_overrides (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  module_key VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  reason TEXT,
  overridden_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, module_key)
);

CREATE TABLE IF NOT EXISTS dape_module_access_log (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  user_id INTEGER,
  module_key VARCHAR(50) NOT NULL,
  endpoint VARCHAR(200),
  access_granted BOOLEAN,
  reason_denied TEXT,
  accessed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_plans_company ON dape_tenant_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_plan_modules_plan ON dape_plan_modules(plan_id);
CREATE INDEX IF NOT EXISTS idx_overrides_company ON dape_tenant_module_overrides(company_id);
CREATE INDEX IF NOT EXISTS idx_access_log_company ON dape_module_access_log(company_id);
CREATE INDEX IF NOT EXISTS idx_access_log_date ON dape_module_access_log(accessed_at);

-- Plano Master
INSERT INTO dape_plans (name, slug, description, is_master, max_users, max_contacts)
VALUES ('Master', 'master', 'Conta administrativa com acesso total', TRUE, 999, 999999)
ON CONFLICT (slug) DO NOTHING;

-- Todos os módulos no plano Master
INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled)
SELECT p.id, m.module_key, TRUE
FROM dape_plans p, dape_available_modules m
WHERE p.slug = 'master'
ON CONFLICT (plan_id, module_key) DO NOTHING;

-- Plano Starter
INSERT INTO dape_plans (name, slug, description, price_monthly, max_users, max_contacts)
VALUES ('Starter', 'starter', 'Pipeline e Analytics básico', 197.00, 3, 500)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled)
SELECT p.id, unnest(ARRAY['dape_pipeline','dape_analytics']), TRUE
FROM dape_plans p WHERE p.slug = 'starter'
ON CONFLICT (plan_id, module_key) DO NOTHING;

-- Plano Pro
INSERT INTO dape_plans (name, slug, description, price_monthly, max_users, max_contacts)
VALUES ('Pro', 'pro', 'Pipeline, Analytics, IA e Growth', 397.00, 10, 2000)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled)
SELECT p.id, unnest(ARRAY['dape_pipeline','dape_analytics','dape_ia','dape_growth']), TRUE
FROM dape_plans p WHERE p.slug = 'pro'
ON CONFLICT (plan_id, module_key) DO NOTHING;

-- Plano Enterprise
INSERT INTO dape_plans (name, slug, description, price_monthly, max_users, max_contacts)
VALUES ('Enterprise', 'enterprise', 'Acesso completo a todos os módulos', 897.00, 999, 99999)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled)
SELECT p.id, m.module_key, TRUE
FROM dape_plans p, dape_available_modules m
WHERE p.slug = 'enterprise'
ON CONFLICT (plan_id, module_key) DO NOTHING;

COMMIT;
