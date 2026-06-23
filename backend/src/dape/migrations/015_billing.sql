-- ============================================================
-- DAPLE Billing System — Migração 015
-- Integração com Asaas: cobrança automática + usuários extras
-- ============================================================
BEGIN;

-- ─── 1. ALTERAÇÕES EM dape_plans ─────────────────────────────────────────────
-- Preço por usuário extra (varia por plano: plano mais completo = extra mais caro)
ALTER TABLE dape_plans
  ADD COLUMN IF NOT EXISTS extra_user_price DECIMAL(10,2) DEFAULT 0.00;

-- Dias de trial gratuito (0 = sem trial)
ALTER TABLE dape_plans
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0;

-- Dias de tolerância após vencimento antes de bloquear (default: 3 dias)
ALTER TABLE dape_plans
  ADD COLUMN IF NOT EXISTS grace_days INTEGER DEFAULT 3;

-- Padronizar limite de usuários base em 5 para todos os planos (exceto Master)
-- Todos os planos têm 5 usuários incluídos; usuários adicionais são contratados à parte
UPDATE dape_plans SET max_users = 5 WHERE is_master = FALSE;

-- Atualizar preços de usuário extra nos planos padrão (valores sugeridos)
-- Plano Starter: R$ 29,90/usuário extra
UPDATE dape_plans SET extra_user_price = 29.90 WHERE slug = 'starter';
-- Plano Pro: R$ 49,90/usuário extra
UPDATE dape_plans SET extra_user_price = 49.90 WHERE slug = 'pro';
-- Plano Enterprise: R$ 79,90/usuário extra
UPDATE dape_plans SET extra_user_price = 79.90 WHERE slug = 'enterprise';

-- ─── 2. ALTERAÇÕES EM dape_tenant_plans ──────────────────────────────────────
-- Status de billing da assinatura
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS billing_status VARCHAR(30) DEFAULT 'active'
    CHECK (billing_status IN ('trialing','pending_first_payment','active','past_due','blocked','canceled','expired'));

-- Status de acesso (fonte de verdade para liberar/bloquear o sistema)
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) DEFAULT 'allowed'
    CHECK (access_status IN ('allowed','grace','blocked'));

-- IDs do cliente e assinatura no Asaas
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100);

ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(100);

-- Forma de pagamento escolhida pelo cliente
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) DEFAULT 'PIX'
    CHECK (billing_type IN ('CREDIT_CARD','PIX','BOLETO'));

-- Quantidade de usuários extras contratados (além dos 5 do plano base)
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS extra_users_count INTEGER DEFAULT 0;

-- Próximo vencimento da cobrança
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS next_due_date DATE;

-- Até quando o acesso em grace period está liberado
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMP WITH TIME ZONE;

-- Quando foi o último pagamento confirmado
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP WITH TIME ZONE;

-- Quando foi bloqueado por inadimplência
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE;

-- Cancelamento ao fim do ciclo (true = cancela no vencimento, não imediatamente)
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Quando foi cancelado
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;

-- Início e fim do período atual de cobrança
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE;

ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- Fim do trial (null se não há trial)
ALTER TABLE dape_tenant_plans
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- ─── 3. TABELA: dape_billing_invoices ────────────────────────────────────────
-- Registra cada fatura/cobrança gerada pelo Asaas
CREATE TABLE IF NOT EXISTS dape_billing_invoices (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL,
  tenant_plan_id        INTEGER REFERENCES dape_tenant_plans(id) ON DELETE SET NULL,

  -- Referências no Asaas
  asaas_payment_id      VARCHAR(100) UNIQUE,
  asaas_subscription_id VARCHAR(100),

  -- Valores
  amount                DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_amount            DECIMAL(10,2),

  -- Datas
  due_date              DATE NOT NULL,
  original_due_date     DATE,
  paid_at               TIMESTAMP WITH TIME ZONE,
  confirmed_at          TIMESTAMP WITH TIME ZONE,
  overdue_at            TIMESTAMP WITH TIME ZONE,
  refunded_at           TIMESTAMP WITH TIME ZONE,

  -- Status da fatura
  status                VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','received','overdue','refunded','deleted','chargeback')),

  -- Forma de pagamento
  billing_type          VARCHAR(20),

  -- Links de pagamento
  invoice_url           TEXT,
  bank_slip_url         TEXT,
  pix_qr_code           TEXT,
  pix_copy_paste        TEXT,

  -- Origem do registro
  event_origin          VARCHAR(30) DEFAULT 'webhook'
    CHECK (event_origin IN ('webhook','manual','reconciliation')),

  -- Payload bruto do Asaas (para auditoria e replay)
  raw_payload           JSONB,

  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_company    ON dape_billing_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_asaas_pay  ON dape_billing_invoices(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status     ON dape_billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date   ON dape_billing_invoices(due_date);

-- ─── 4. TABELA: dape_billing_events ──────────────────────────────────────────
-- Auditoria e idempotência dos webhooks recebidos do Asaas
CREATE TABLE IF NOT EXISTS dape_billing_events (
  id                    SERIAL PRIMARY KEY,
  gateway               VARCHAR(20) DEFAULT 'asaas',

  -- ID único do evento no Asaas (usado para idempotência)
  event_id              VARCHAR(100) NOT NULL,
  event_type            VARCHAR(50) NOT NULL,

  -- Referências
  company_id            INTEGER,
  asaas_payment_id      VARCHAR(100),
  asaas_subscription_id VARCHAR(100),

  -- Payload bruto recebido
  payload               JSONB NOT NULL,

  -- Controle de processamento
  processing_status     VARCHAR(20) DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processed','ignored','error')),
  processing_error      TEXT,

  received_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at          TIMESTAMP WITH TIME ZONE,

  UNIQUE (gateway, event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_status    ON dape_billing_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_billing_events_type      ON dape_billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_received  ON dape_billing_events(received_at);

-- ─── 5. TABELA: dape_extra_user_requests ─────────────────────────────────────
-- Histórico de contratações e cancelamentos de usuários extras (self-service)
CREATE TABLE IF NOT EXISTS dape_extra_user_requests (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL,
  tenant_plan_id        INTEGER REFERENCES dape_tenant_plans(id) ON DELETE SET NULL,

  -- Quantidade antes e depois da alteração
  previous_extra_users  INTEGER NOT NULL DEFAULT 0,
  new_extra_users       INTEGER NOT NULL DEFAULT 0,

  -- Tipo de operação
  action                VARCHAR(20) NOT NULL
    CHECK (action IN ('add','remove')),

  -- Quem solicitou (admin da empresa ou master)
  requested_by_user_id  INTEGER,
  requested_by_role     VARCHAR(20) DEFAULT 'admin',

  -- Valor cobrado por usuário extra no momento da contratação
  unit_price_at_time    DECIMAL(10,2),

  -- Novo valor mensal total após a alteração
  new_monthly_amount    DECIMAL(10,2),

  -- Se gerou cobrança proporcional (pró-rata) no Asaas
  asaas_prorata_payment_id VARCHAR(100),

  notes                 TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extra_user_requests_company ON dape_extra_user_requests(company_id);

-- ─── 6. COMENTÁRIOS DESCRITIVOS ──────────────────────────────────────────────
COMMENT ON COLUMN dape_tenant_plans.billing_status IS
  'Status da assinatura: trialing, pending_first_payment, active, past_due, blocked, canceled, expired';

COMMENT ON COLUMN dape_tenant_plans.access_status IS
  'Fonte de verdade para controle de acesso: allowed (acesso total), grace (acesso com aviso), blocked (acesso negado)';

COMMENT ON COLUMN dape_tenant_plans.extra_users_count IS
  'Quantidade de usuários extras contratados além do limite base do plano (max_users). Total permitido = max_users + extra_users_count';

COMMENT ON COLUMN dape_plans.extra_user_price IS
  'Valor mensal cobrado por cada usuário extra contratado neste plano. Planos mais completos têm valor maior.';

COMMIT;
