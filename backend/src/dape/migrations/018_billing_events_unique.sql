-- ============================================================
-- DAPLE Billing — Migração 018
-- Nomeia a constraint UNIQUE de billing_events para que seja
-- referenciável pelo nome em ON CONFLICT e em monitoring.
-- Idempotente: pode ser re-executada sem erros.
-- ============================================================
DO $$
DECLARE
  v_old_constraint TEXT;
BEGIN
  -- Encontra a constraint unique anônima criada pela migration 015 (se existir)
  SELECT conname INTO v_old_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'dape_billing_events'::regclass
    AND c.contype  = 'u'
    AND c.conname != 'uq_billing_events_gateway_event'
    AND (
      SELECT array_agg(a.attname ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    ) = ARRAY['event_id', 'gateway']
  LIMIT 1;

  -- Remove a constraint anônima para evitar índice duplicado
  IF v_old_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dape_billing_events DROP CONSTRAINT ' || quote_ident(v_old_constraint);
  END IF;

  -- Adiciona a constraint nomeada se ainda não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_billing_events_gateway_event'
      AND conrelid = 'dape_billing_events'::regclass
  ) THEN
    ALTER TABLE dape_billing_events
      ADD CONSTRAINT uq_billing_events_gateway_event
      UNIQUE (gateway, event_id);
  END IF;
END $$;
