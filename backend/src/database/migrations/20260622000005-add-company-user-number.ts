import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Users") as Record<string, unknown>;
    if (!tableDesc.companyUserNumber) {
      await queryInterface.addColumn("Users", "companyUserNumber", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION assign_company_user_number()
      RETURNS TRIGGER AS $$
      DECLARE next_num INTEGER;
      BEGIN
        SELECT COALESCE(MAX("companyUserNumber"), 0) + 1 INTO next_num
        FROM "Users" WHERE "companyId" = NEW."companyId";
        NEW."companyUserNumber" = next_num;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_assign_company_user_number ON "Users";
      CREATE TRIGGER trg_assign_company_user_number
        BEFORE INSERT ON "Users"
        FOR EACH ROW
        WHEN (NEW."companyUserNumber" IS NULL)
        EXECUTE FUNCTION assign_company_user_number();
    `);

    // Backfill
    await queryInterface.sequelize.query(`
      UPDATE "Users" u SET "companyUserNumber" = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY id) as rn
        FROM "Users"
      ) sub
      WHERE u.id = sub.id AND u."companyUserNumber" IS NULL;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_assign_company_user_number ON "Users";`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS assign_company_user_number();`);
    await queryInterface.removeColumn("Users", "companyUserNumber");
  }
};
