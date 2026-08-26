import { QueryInterface, DataTypes } from "sequelize";

// Campos exclusivos do fluxo de Coexistence (WhatsApp Business App +
// Cloud API simultaneos). Nao alteram o comportamento de conexoes
// existentes (session/meta_cloud) - nullable, preenchidos so quando
// providerType = "meta_cloud_coexistence".
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = (await queryInterface.describeTable(
      "Whatsapps"
    )) as Record<string, unknown>;

    if (!tableDesc.isOnBizApp) {
      await queryInterface.addColumn("Whatsapps", "isOnBizApp", {
        type: DataTypes.BOOLEAN,
        allowNull: true
      });
    }
    if (!tableDesc.platformType) {
      await queryInterface.addColumn("Whatsapps", "platformType", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "isOnBizApp").catch(() => {});
    await queryInterface.removeColumn("Whatsapps", "platformType").catch(() => {});
  }
};
