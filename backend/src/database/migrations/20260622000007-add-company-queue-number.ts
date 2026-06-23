import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Queues") as Record<string, unknown>;
    if (!tableDesc.companyQueueNumber) {
      await queryInterface.addColumn("Queues", "companyQueueNumber", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION assign_company_queue_number()
      RETURNS TRIGGER AS $$
      DECLARE next_num INTEGER;
      BEGIN
        SELECT COALESCE(MAX("companyQueueNumber"), 0) + 1 INTO next_num
        FROM "Queues" WHERE "companyId" = NEW."companyId";
        NEW."companyQueueNumber" = next_num;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_assign_company_queue_number ON "Queues";
      CREATE TRIGGER trg_assign_company_queue_number
        BEFORE INSERT ON "Queues"
        FOR EACH ROW
        WHEN (NEW."companyQueueNumber" IS NULL)
        EXECUTE FUNCTION assign_company_queue_number();
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Queues" q SET "companyQueueNumber" = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY id) as rn
        FROM "Queues"
      ) sub
      WHERE q.id = sub.id AND q."companyQueueNumber" IS NULL;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_assign_company_queue_number ON "Queues";`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS assign_company_queue_number();`);
    await queryInterface.removeColumn("Queues", "companyQueueNumber");
  }
};
