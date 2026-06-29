import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Whatsapps") as Record<string, unknown>;
    if (!tableDesc.providerType) {
      await queryInterface.addColumn("Whatsapps", "providerType", {
        type: DataTypes.STRING(50),
        defaultValue: "session",
        allowNull: false,
      });
    }
    if (!tableDesc.wabaId) {
      await queryInterface.addColumn("Whatsapps", "wabaId", {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.phoneNumberId) {
      await queryInterface.addColumn("Whatsapps", "phoneNumberId", {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.metaAccessToken) {
      await queryInterface.addColumn("Whatsapps", "metaAccessToken", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
    if (!tableDesc.tokenExpiresAt) {
      await queryInterface.addColumn("Whatsapps", "tokenExpiresAt", {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!tableDesc.embeddedSignupSessionId) {
      await queryInterface.addColumn("Whatsapps", "embeddedSignupSessionId", {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.migrationStatus) {
      await queryInterface.addColumn("Whatsapps", "migrationStatus", {
        type: DataTypes.STRING(50),
        defaultValue: "none",
        allowNull: false,
      });
    }
    if (!tableDesc.previousProviderType) {
      await queryInterface.addColumn("Whatsapps", "previousProviderType", {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const cols = [
      "providerType",
      "wabaId",
      "phoneNumberId",
      "metaAccessToken",
      "tokenExpiresAt",
      "embeddedSignupSessionId",
      "migrationStatus",
      "previousProviderType",
    ];
    for (const col of cols) {
      await queryInterface.removeColumn("Whatsapps", col).catch(() => {});
    }
  },
};
