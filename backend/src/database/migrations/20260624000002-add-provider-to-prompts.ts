import { QueryInterface } from "sequelize";

/**
 * Migration: Adiciona colunas de provider/voz à tabela Prompts
 * - provider: provedor de IA (openai, anthropic, gemini, manus)
 * - baseUrl: URL base customizada (Manus/self-hosted)
 * - voice: modo de voz (texto, alloy, echo, fable, onyx, nova, shimmer)
 * - voiceKey: chave de API para TTS (Azure/Google)
 * - voiceRegion: região do serviço TTS (Azure)
 * - ttsProvider: provedor de TTS (azure, google, openai)
 *
 * Idempotente: ADD COLUMN IF NOT EXISTS
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Prompts"
        ADD COLUMN IF NOT EXISTS provider    VARCHAR(50)  NOT NULL DEFAULT 'openai',
        ADD COLUMN IF NOT EXISTS "baseUrl"   TEXT,
        ADD COLUMN IF NOT EXISTS voice       VARCHAR(100) DEFAULT 'texto',
        ADD COLUMN IF NOT EXISTS "voiceKey"  TEXT,
        ADD COLUMN IF NOT EXISTS "voiceRegion" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "ttsProvider" VARCHAR(20) DEFAULT 'azure';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Prompts"
        DROP COLUMN IF EXISTS provider,
        DROP COLUMN IF EXISTS "baseUrl",
        DROP COLUMN IF EXISTS voice,
        DROP COLUMN IF EXISTS "voiceKey",
        DROP COLUMN IF EXISTS "voiceRegion",
        DROP COLUMN IF EXISTS "ttsProvider";
    `);
  }
};
