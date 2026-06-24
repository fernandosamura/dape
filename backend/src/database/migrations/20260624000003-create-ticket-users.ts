import { QueryInterface } from "sequelize";

/**
 * Migration: Cria tabela TicketUsers
 * Tabela intermediaria para suporte a multiplos atendentes em grupos de WhatsApp.
 * Um ticket de grupo pode ter N usuarios (atendentes) associados simultaneamente.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "TicketUsers" (
        id          SERIAL PRIMARY KEY,
        "ticketId"  INTEGER NOT NULL REFERENCES "Tickets"(id) ON DELETE CASCADE,
        "userId"    INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE ("ticketId", "userId")
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_users_ticket ON "TicketUsers" ("ticketId");
      CREATE INDEX IF NOT EXISTS idx_ticket_users_user   ON "TicketUsers" ("userId");
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "TicketUsers";`);
  }
};
