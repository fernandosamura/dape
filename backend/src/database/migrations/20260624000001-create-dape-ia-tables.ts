import { QueryInterface } from "sequelize";

/**
 * Migration: Cria tabelas para o módulo DAPE IA
 * - dape_ia_rate_limits: controle de rate limiting por empresa
 * - dape_ia_summaries: resumos gerados por IA por ticket
 * - dape_ia_suggestions: sugestões de resposta/ação por ticket
 *
 * Idempotente: usa CREATE TABLE IF NOT EXISTS e ADD COLUMN IF NOT EXISTS
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_ia_rate_limits (
        id           SERIAL PRIMARY KEY,
        company_id   INTEGER NOT NULL,
        window_start TIMESTAMP NOT NULL,
        call_count   INTEGER DEFAULT 0,
        CONSTRAINT dape_ia_rate_limits_company_id_window_start_key UNIQUE (company_id, window_start)
      );

      CREATE INDEX IF NOT EXISTS idx_dape_ratelimit_company
        ON dape_ia_rate_limits (company_id, window_start);
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_ia_summaries (
        id              SERIAL PRIMARY KEY,
        ticket_id       INTEGER NOT NULL,
        contact_id      INTEGER,
        company_id      INTEGER NOT NULL DEFAULT 1,
        summary_text    TEXT NOT NULL,
        next_action     TEXT,
        sentiment       VARCHAR(20) CHECK (sentiment IN ('positivo','neutro','negativo')),
        intent          VARCHAR(50),
        urgency         VARCHAR(10) CHECK (urgency IN ('alta','media','baixa')),
        estimated_value NUMERIC(10,2),
        model_used      VARCHAR(50),
        tokens_used     INTEGER,
        generated_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_dape_summaries_ticket  ON dape_ia_summaries (ticket_id);
      CREATE INDEX IF NOT EXISTS idx_dape_summaries_company ON dape_ia_summaries (company_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dape_ia_suggestions (
        id              SERIAL PRIMARY KEY,
        ticket_id       INTEGER NOT NULL,
        company_id      INTEGER NOT NULL DEFAULT 1,
        suggestion_type VARCHAR(30),
        suggestion_text TEXT NOT NULL,
        was_used        BOOLEAN DEFAULT false,
        used_at         TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_dape_suggestions_ticket ON dape_ia_suggestions (ticket_id);
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dape_ia_suggestions;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dape_ia_summaries;`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dape_ia_rate_limits;`);
  }
};
