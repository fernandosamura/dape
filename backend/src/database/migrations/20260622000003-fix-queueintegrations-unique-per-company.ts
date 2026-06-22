import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`ALTER TABLE "QueueIntegrations" DROP CONSTRAINT IF EXISTS "QueueIntegrations_name_key";`);
    await queryInterface.sequelize.query(`ALTER TABLE "QueueIntegrations" DROP CONSTRAINT IF EXISTS "QueueIntegrations_projectName_key";`);
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'QueueIntegrations' AND column_name = 'companyId') THEN
          ALTER TABLE "QueueIntegrations" ADD CONSTRAINT "QueueIntegrations_name_companyId_unique" UNIQUE (name, "companyId");
        END IF;
      END $$;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`ALTER TABLE "QueueIntegrations" DROP CONSTRAINT IF EXISTS "QueueIntegrations_name_companyId_unique";`);
    await queryInterface.sequelize.query(`ALTER TABLE "QueueIntegrations" ADD CONSTRAINT "QueueIntegrations_name_key" UNIQUE (name);`);
    await queryInterface.sequelize.query(`ALTER TABLE "QueueIntegrations" ADD CONSTRAINT "QueueIntegrations_projectName_key" UNIQUE ("projectName");`);
  }
};
