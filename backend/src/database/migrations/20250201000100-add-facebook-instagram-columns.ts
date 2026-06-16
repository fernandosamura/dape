import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("Whatsapps");
    
    if (!(tableDesc as any).channel) {
      await queryInterface.addColumn("Whatsapps", "channel", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "whatsapp"
      });
    }
    if (!(tableDesc as any).facebookPageUserId) {
      await queryInterface.addColumn("Whatsapps", "facebookPageUserId", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
    const tableDescAny: any = tableDesc;
    if (!tableDescAny.facebookToken) {
      await queryInterface.addColumn("Whatsapps", "facebookToken", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
    if (!tableDescAny.facebookUserToken) {
      await queryInterface.addColumn("Whatsapps", "facebookUserToken", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "channel");
    await queryInterface.removeColumn("Whatsapps", "facebookPageUserId");
    await queryInterface.removeColumn("Whatsapps", "facebookToken");
    await queryInterface.removeColumn("Whatsapps", "facebookUserToken");
  }
};
