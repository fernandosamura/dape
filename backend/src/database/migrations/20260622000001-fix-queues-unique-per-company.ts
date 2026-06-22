import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Drop global unique constraints
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_name_key";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_color_key";
    `);
    
    // Add per-company composite unique constraints
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" 
      ADD CONSTRAINT "Queues_name_companyId_unique" 
      UNIQUE (name, "companyId");
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" 
      ADD CONSTRAINT "Queues_color_companyId_unique" 
      UNIQUE (color, "companyId");
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_name_companyId_unique";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_color_companyId_unique";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" ADD CONSTRAINT "Queues_name_key" UNIQUE (name);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues" ADD CONSTRAINT "Queues_color_key" UNIQUE (color);
    `);
  }
};
