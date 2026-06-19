import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Plans");
    const tableDescAny: any = tableDesc;

    if (!tableDescAny.allowedIaModels) {
      await queryInterface.addColumn("Plans", "allowedIaModels", {
        type: DataTypes.JSONB,
        allowNull: true,
      });
    }

    if (!tableDescAny.useIaAudioReply) {
      await queryInterface.addColumn("Plans", "useIaAudioReply", {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Plans", "allowedIaModels");
    await queryInterface.removeColumn("Plans", "useIaAudioReply");
  },
};
