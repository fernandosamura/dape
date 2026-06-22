import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Settings_companyId_key_unique') THEN
          ALTER TABLE "Settings" ADD CONSTRAINT "Settings_companyId_key_unique" UNIQUE ("companyId", key);
        END IF;
      END $$;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`ALTER TABLE "Settings" DROP CONSTRAINT IF EXISTS "Settings_companyId_key_unique";`);
  }
};
