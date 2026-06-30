-- ============================================================
-- DAPLE Billing — Migração 018
-- Nomeia a constraint UNIQUE de billing_events para que seja
-- referenciável pelo nome em ON CONFLICT e em monitoring.
-- Idempotente: pode ser re-executada sem erros.
-- ============================================================
DO $$
BEGIN
  -- Remove a constraint anônima criada pela migration 015 (nome auto-gerado pelo PostgreSQL)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'dape_billing_events'::regclass
      AND contype  = 'u'
      AND conname  = 'dape_billing_events_gateway_event_id_key'
  ) THEN
    ALTER TABLE dape_billing_events
      DROP CONSTRAINT dape_billing_events_gateway_event_id_key;
  END IF;

  -- Adiciona a constraint nomeada se ainda não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'uq_billing_events_gateway_event'
      AND conrelid   = 'dape_billing_events'::regclass
  ) THEN
    ALTER TABLE dape_billing_events
      ADD CONSTRAINT uq_billing_events_gateway_event
      UNIQUE (gateway, event_id);
  END IF;
END $$;
