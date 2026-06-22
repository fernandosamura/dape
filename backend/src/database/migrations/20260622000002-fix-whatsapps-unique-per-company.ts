import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`ALTER TABLE "Whatsapps" DROP CONSTRAINT IF EXISTS "Whatsapps_name_key";`);
    await queryInterface.sequelize.query(`ALTER TABLE "Whatsapps" ADD CONSTRAINT "Whatsapps_name_companyId_unique" UNIQUE (name, "companyId");`);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`ALTER TABLE "Whatsapps" DROP CONSTRAINT IF EXISTS "Whatsapps_name_companyId_unique";`);
    await queryInterface.sequelize.query(`ALTER TABLE "Whatsapps" ADD CONSTRAINT "Whatsapps_name_key" UNIQUE (name);`);
  }
};
