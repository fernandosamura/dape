ALTER TABLE dape_tenant_module_overrides 
  ADD COLUMN IF NOT EXISTS operation_mode VARCHAR(20) DEFAULT 'assisted' 
  CHECK (operation_mode IN ('disabled', 'assisted', 'automatic'));

ALTER TABLE dape_plan_modules 
  ADD COLUMN IF NOT EXISTS operation_mode VARCHAR(20) DEFAULT 'assisted' 
  CHECK (operation_mode IN ('disabled', 'assisted', 'automatic'));
