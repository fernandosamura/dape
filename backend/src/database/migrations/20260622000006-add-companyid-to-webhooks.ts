import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Webhooks").catch(() => null);
    if (!tableDesc) return; // table doesn't exist, skip

    if (!tableDesc.company_id) {
      await queryInterface.addColumn("Webhooks", "company_id", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    // Backfill
    await queryInterface.sequelize.query(`
      UPDATE "Webhooks" w
      SET "company_id" = u."companyId"
      FROM "Users" u
      WHERE u.id = w.user_id AND w."company_id" IS NULL;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Webhooks").catch(() => null);
    if (tableDesc?.company_id) {
      await queryInterface.removeColumn("Webhooks", "company_id");
    }
  }
};
