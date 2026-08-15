import { QueryInterface } from "sequelize";

// Reconstroi no historico de migrations as tabelas do modulo de
// planos/billing/modulos (dape_plans, dape_tenant_plans, dape_plan_modules,
// dape_available_modules, dape_tenant_module_overrides), que existiam em
// producao sem nenhuma migration de criacao neste repo - foram criadas
// direto via SQL manual em algum momento nao documentado antes desta sessao.
// Schema conferido direto em producao (somente leitura, autorizado) em
// 2026-08-15 via \d em cada tabela - CREATE TABLE IF NOT EXISTS mantem isso
// idempotente e um no-op la, so preenche o gap pra bancos novos.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_plans (
        id                  SERIAL PRIMARY KEY,
        name                VARCHAR(100) NOT NULL,
        slug                VARCHAR(50) NOT NULL UNIQUE,
        description         TEXT,
        price_monthly       DECIMAL(10,2),
        price_yearly        DECIMAL(10,2),
        is_active           BOOLEAN DEFAULT TRUE,
        is_master           BOOLEAN DEFAULT FALSE,
        max_users           INTEGER DEFAULT 5,
        max_contacts        INTEGER DEFAULT 1000,
        max_connections     INTEGER DEFAULT 3,
        max_queues          INTEGER DEFAULT 3,
        native_plan_id      INTEGER,
        use_campaigns       BOOLEAN DEFAULT FALSE,
        use_schedules       BOOLEAN DEFAULT FALSE,
        use_internal_chat   BOOLEAN DEFAULT FALSE,
        use_external_api    BOOLEAN DEFAULT FALSE,
        use_kanban          BOOLEAN DEFAULT FALSE,
        use_openai          BOOLEAN DEFAULT FALSE,
        use_integrations    BOOLEAN DEFAULT FALSE,
        use_facebook        BOOLEAN DEFAULT TRUE,
        use_instagram       BOOLEAN DEFAULT TRUE,
        allowed_ia_models   JSONB DEFAULT '[]'::jsonb,
        use_ia_audio_reply  BOOLEAN DEFAULT FALSE,
        extra_user_price    DECIMAL(10,2) DEFAULT 0.00,
        trial_days          INTEGER DEFAULT 0,
        grace_days          INTEGER DEFAULT 3,
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dape_tenant_plans (
        id                     SERIAL PRIMARY KEY,
        company_id             INTEGER NOT NULL UNIQUE,
        plan_id                INTEGER REFERENCES dape_plans(id),
        is_master              BOOLEAN DEFAULT FALSE,
        plan_starts_at         DATE DEFAULT CURRENT_DATE,
        plan_ends_at           DATE,
        is_active              BOOLEAN DEFAULT TRUE,
        notes                  TEXT,
        billing_status         VARCHAR(30) DEFAULT 'active',
        access_status          VARCHAR(20) DEFAULT 'allowed',
        asaas_customer_id      VARCHAR(100),
        asaas_subscription_id  VARCHAR(100),
        billing_type           VARCHAR(20) DEFAULT 'PIX',
        extra_users_count      INTEGER DEFAULT 0,
        next_due_date          DATE,
        grace_until            TIMESTAMP WITH TIME ZONE,
        last_payment_at        TIMESTAMP WITH TIME ZONE,
        blocked_at             TIMESTAMP WITH TIME ZONE,
        cancel_at_period_end   BOOLEAN DEFAULT FALSE,
        canceled_at            TIMESTAMP WITH TIME ZONE,
        current_period_start   TIMESTAMP WITH TIME ZONE,
        current_period_end     TIMESTAMP WITH TIME ZONE,
        trial_ends_at          TIMESTAMP WITH TIME ZONE,
        created_at             TIMESTAMP DEFAULT NOW(),
        updated_at             TIMESTAMP DEFAULT NOW(),
        CONSTRAINT dape_tenant_plans_billing_status_check CHECK (
          billing_status IN ('trialing','pending_first_payment','active','past_due','blocked','canceled','expired')
        ),
        CONSTRAINT dape_tenant_plans_access_status_check CHECK (
          access_status IN ('allowed','grace','blocked')
        ),
        CONSTRAINT dape_tenant_plans_billing_type_check CHECK (
          billing_type IN ('CREDIT_CARD','PIX','BOLETO')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_plans_company ON dape_tenant_plans(company_id);

      CREATE TABLE IF NOT EXISTS dape_plan_modules (
        id              SERIAL PRIMARY KEY,
        plan_id         INTEGER REFERENCES dape_plans(id) ON DELETE CASCADE,
        module_key      VARCHAR(50) NOT NULL,
        is_enabled      BOOLEAN DEFAULT TRUE,
        operation_mode  VARCHAR(20) DEFAULT 'assisted'
          CHECK (operation_mode IN ('disabled','assisted','automatic')),
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE (plan_id, module_key)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_modules_plan ON dape_plan_modules(plan_id);

      CREATE TABLE IF NOT EXISTS dape_available_modules (
        id            SERIAL PRIMARY KEY,
        module_key    VARCHAR(50) NOT NULL UNIQUE,
        module_name   VARCHAR(100) NOT NULL,
        description   TEXT,
        icon          VARCHAR(50),
        sort_order    INTEGER DEFAULT 0,
        is_active     BOOLEAN DEFAULT TRUE,
        created_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dape_tenant_module_overrides (
        id              SERIAL PRIMARY KEY,
        company_id      INTEGER NOT NULL,
        module_key      VARCHAR(50) NOT NULL,
        is_enabled      BOOLEAN NOT NULL,
        reason          TEXT,
        overridden_by   INTEGER,
        operation_mode  VARCHAR(20) DEFAULT 'assisted'
          CHECK (operation_mode IN ('disabled','assisted','automatic')),
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE (company_id, module_key)
      );
      CREATE INDEX IF NOT EXISTS idx_overrides_company ON dape_tenant_module_overrides(company_id);
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS dape_tenant_module_overrides;
      DROP TABLE IF EXISTS dape_available_modules;
      DROP TABLE IF EXISTS dape_plan_modules;
      DROP TABLE IF EXISTS dape_tenant_plans;
      DROP TABLE IF EXISTS dape_plans;
    `);
  }
};
