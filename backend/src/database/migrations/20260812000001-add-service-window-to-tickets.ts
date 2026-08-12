import { QueryInterface, DataTypes } from "sequelize";

// Janela de atendimento de 24h (Meta Cloud API) - registra a ultima mensagem
// recebida do cliente e quando a janela de mensagem livre expira. So
// atualizado no fluxo inbound (webhook); mensagens da propria empresa nunca
// tocam essas colunas.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = (await queryInterface.describeTable(
      "Tickets"
    )) as Record<string, unknown>;

    if (!tableDesc.lastInboundMessageAt) {
      await queryInterface.addColumn("Tickets", "lastInboundMessageAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
    if (!tableDesc.serviceWindowExpiresAt) {
      await queryInterface.addColumn("Tickets", "serviceWindowExpiresAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const cols = ["lastInboundMessageAt", "serviceWindowExpiresAt"];
    for (const col of cols) {
      await queryInterface.removeColumn("Tickets", col).catch(() => {});
    }
  }
};
