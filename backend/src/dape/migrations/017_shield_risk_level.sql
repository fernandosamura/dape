ALTER TABLE daple_shield_config
  ADD COLUMN IF NOT EXISTS degraded_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE;
