import { QueryInterface } from "sequelize";

/**
 * Migração de Billing — DAPLE
 * Cria as tabelas e colunas necessárias para o sistema de cobrança automática
 * com integração ao Asaas e suporte a usuários extras por plano.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // ─── 1. Alterações em dape_plans ─────────────────────────────────────────
    await queryInterface.sequelize.query(`
      ALTER TABLE dape_plans
        ADD COLUMN IF NOT EXISTS extra_user_price DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grace_days INTEGER DEFAULT 3;
    `);

    // Padronizar max_users = 5 para todos os planos (exceto Master)
    await queryInterface.sequelize.query(`
      UPDATE dape_plans SET max_users = 5 WHERE is_master = FALSE;
    `);

    // Preços sugeridos de usuário extra por plano
    await queryInterface.sequelize.query(`
      UPDATE dape_plans SET extra_user_price = 29.90 WHERE slug = 'starter' AND extra_user_price = 0;
      UPDATE dape_plans SET extra_user_price = 49.90 WHERE slug = 'pro'     AND extra_user_price = 0;
      UPDATE dape_plans SET extra_user_price = 79.90 WHERE slug = 'enterprise' AND extra_user_price = 0;
    `);

    // ─── 2. Alterações em dape_tenant_plans ──────────────────────────────────
    await queryInterface.sequelize.query(`
      ALTER TABLE dape_tenant_plans
        ADD COLUMN IF NOT EXISTS billing_status VARCHAR(30) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) DEFAULT 'allowed',
        ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) DEFAULT 'PIX',
        ADD COLUMN IF NOT EXISTS extra_users_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS next_due_date DATE,
        ADD COLUMN IF NOT EXISTS grace_until TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
    `);

    // Adicionar constraints de CHECK separadamente (IF NOT EXISTS não funciona para constraints)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'dape_tenant_plans_billing_status_check'
        ) THEN
          ALTER TABLE dape_tenant_plans
            ADD CONSTRAINT dape_tenant_plans_billing_status_check
            CHECK (billing_status IN ('trialing','pending_first_payment','active','past_due','blocked','canceled','expired'));
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'dape_tenant_plans_access_status_check'
        ) THEN
          ALTER TABLE dape_tenant_plans
            ADD CONSTRAINT dape_tenant_plans_access_status_check
            CHECK (access_status IN ('allowed','grace','blocked'));
        END IF;
      END $$;
    `);

    // ─── 3. Tabela dape_billing_invoices ─────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_billing_invoices (
        id                    SERIAL PRIMARY KEY,
        company_id            INTEGER NOT NULL,
        tenant_plan_id        INTEGER REFERENCES dape_tenant_plans(id) ON DELETE SET NULL,
        asaas_payment_id      VARCHAR(100) UNIQUE,
        asaas_subscription_id VARCHAR(100),
        amount                DECIMAL(10,2) NOT NULL DEFAULT 0,
        net_amount            DECIMAL(10,2),
        due_date              DATE NOT NULL,
        original_due_date     DATE,
        paid_at               TIMESTAMP WITH TIME ZONE,
        confirmed_at          TIMESTAMP WITH TIME ZONE,
        overdue_at            TIMESTAMP WITH TIME ZONE,
        refunded_at           TIMESTAMP WITH TIME ZONE,
        status                VARCHAR(30) DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','received','overdue','refunded','deleted','chargeback')),
        billing_type          VARCHAR(20),
        invoice_url           TEXT,
        bank_slip_url         TEXT,
        pix_qr_code           TEXT,
        pix_copy_paste        TEXT,
        event_origin          VARCHAR(30) DEFAULT 'webhook'
          CHECK (event_origin IN ('webhook','manual','reconciliation')),
        raw_payload           JSONB,
        created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_billing_invoices_company    ON dape_billing_invoices(company_id);
      CREATE INDEX IF NOT EXISTS idx_billing_invoices_asaas_pay  ON dape_billing_invoices(asaas_payment_id);
      CREATE INDEX IF NOT EXISTS idx_billing_invoices_status     ON dape_billing_invoices(status);
      CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date   ON dape_billing_invoices(due_date);
    `);

    // ─── 4. Tabela dape_billing_events ───────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_billing_events (
        id                    SERIAL PRIMARY KEY,
        gateway               VARCHAR(20) DEFAULT 'asaas',
        event_id              VARCHAR(100) NOT NULL,
        event_type            VARCHAR(50) NOT NULL,
        company_id            INTEGER,
        asaas_payment_id      VARCHAR(100),
        asaas_subscription_id VARCHAR(100),
        payload               JSONB NOT NULL,
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
    `);

    // ─── 5. Tabela dape_extra_user_requests ──────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_extra_user_requests (
        id                       SERIAL PRIMARY KEY,
        company_id               INTEGER NOT NULL,
        tenant_plan_id           INTEGER REFERENCES dape_tenant_plans(id) ON DELETE SET NULL,
        previous_extra_users     INTEGER NOT NULL DEFAULT 0,
        new_extra_users          INTEGER NOT NULL DEFAULT 0,
        action                   VARCHAR(20) NOT NULL
          CHECK (action IN ('add','remove')),
        requested_by_user_id     INTEGER,
        requested_by_role        VARCHAR(20) DEFAULT 'admin',
        unit_price_at_time       DECIMAL(10,2),
        new_monthly_amount       DECIMAL(10,2),
        asaas_prorata_payment_id VARCHAR(100),
        notes                    TEXT,
        created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_extra_user_requests_company ON dape_extra_user_requests(company_id);
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dape_extra_user_requests;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dape_billing_events;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dape_billing_invoices;`);

    await queryInterface.sequelize.query(`
      ALTER TABLE dape_tenant_plans
        DROP COLUMN IF EXISTS billing_status,
        DROP COLUMN IF EXISTS access_status,
        DROP COLUMN IF EXISTS asaas_customer_id,
        DROP COLUMN IF EXISTS asaas_subscription_id,
        DROP COLUMN IF EXISTS billing_type,
        DROP COLUMN IF EXISTS extra_users_count,
        DROP COLUMN IF EXISTS next_due_date,
        DROP COLUMN IF EXISTS grace_until,
        DROP COLUMN IF EXISTS last_payment_at,
        DROP COLUMN IF EXISTS blocked_at,
        DROP COLUMN IF EXISTS cancel_at_period_end,
        DROP COLUMN IF EXISTS canceled_at,
        DROP COLUMN IF EXISTS current_period_start,
        DROP COLUMN IF EXISTS current_period_end,
        DROP COLUMN IF EXISTS trial_ends_at;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE dape_plans
        DROP COLUMN IF EXISTS extra_user_price,
        DROP COLUMN IF EXISTS trial_days,
        DROP COLUMN IF EXISTS grace_days;
    `);
  }
};
