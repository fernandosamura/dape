import { QueryInterface, DataTypes } from "sequelize";

// #031 Meta Cloud API - Fase F: campos de saude real do numero, vindos da
// propria Meta (quality_rating, limite de mensagens, status do nome) - o
// DAPLE Shield passa a considerar esses dados reais em vez de so
// heuristicas internas.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = (await queryInterface.describeTable(
      "Whatsapps"
    )) as Record<string, unknown>;

    if (!tableDesc.metaQualityRating) {
      await queryInterface.addColumn("Whatsapps", "metaQualityRating", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
    if (!tableDesc.metaMessagingLimit) {
      await queryInterface.addColumn("Whatsapps", "metaMessagingLimit", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
    if (!tableDesc.metaNameStatus) {
      await queryInterface.addColumn("Whatsapps", "metaNameStatus", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
    if (!tableDesc.metaHealthSyncedAt) {
      await queryInterface.addColumn("Whatsapps", "metaHealthSyncedAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const cols = [
      "metaQualityRating",
      "metaMessagingLimit",
      "metaNameStatus",
      "metaHealthSyncedAt"
    ];
    for (const col of cols) {
      await queryInterface.removeColumn("Whatsapps", col).catch(() => {});
    }
  }
};
