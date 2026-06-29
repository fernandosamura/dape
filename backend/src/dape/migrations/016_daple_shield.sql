BEGIN;

CREATE TABLE IF NOT EXISTS daple_shield_config (
  id                       SERIAL PRIMARY KEY,
  company_id               INTEGER NOT NULL,
  whatsapp_id              INTEGER NOT NULL,
  is_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  max_msgs_per_minute      INTEGER NOT NULL DEFAULT 20,
  max_msgs_per_hour        INTEGER NOT NULL DEFAULT 200,
  max_msgs_per_day         INTEGER NOT NULL DEFAULT 1000,
  business_hours_start     TIME,
  business_hours_end       TIME,
  respect_business_hours   BOOLEAN NOT NULL DEFAULT FALSE,
  auto_quarantine_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  quarantine_threshold_min INTEGER NOT NULL DEFAULT 5,
  quarantine_duration_min  INTEGER NOT NULL DEFAULT 30,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (company_id, whatsapp_id)
);

CREATE TABLE IF NOT EXISTS daple_shield_audit_log (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INTEGER NOT NULL,
  whatsapp_id          INTEGER NOT NULL,
  source               VARCHAR(50) NOT NULL,
  ticket_id            INTEGER,
  contact_number       VARCHAR(30),
  message_preview      VARCHAR(200),
  decision             VARCHAR(10) NOT NULL,
  block_reason         VARCHAR(100),
  msgs_in_last_minute  INTEGER DEFAULT 0,
  msgs_in_last_hour    INTEGER DEFAULT 0,
  msgs_today           INTEGER DEFAULT 0,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shield_audit_company_date ON daple_shield_audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shield_audit_whatsapp_date ON daple_shield_audit_log (whatsapp_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daple_shield_counters (
  whatsapp_id  INTEGER NOT NULL,
  window_type  VARCHAR(10) NOT NULL,
  window_key   VARCHAR(30) NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (whatsapp_id, window_type, window_key)
);

CREATE TABLE IF NOT EXISTS daple_shield_quarantine (
  whatsapp_id      INTEGER PRIMARY KEY,
  company_id       INTEGER NOT NULL,
  quarantined_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quarantine_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reason           VARCHAR(200),
  error_count      INTEGER DEFAULT 1
);

COMMIT;
