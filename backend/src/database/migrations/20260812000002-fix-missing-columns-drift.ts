import { QueryInterface, DataTypes } from "sequelize";

// Corrige drift de schema encontrado ao montar um banco novo a partir do
// zero: Companies.approved e Contacts.isLid sao usados pelos models (e por
// queries reais como ShowPlanCompanyService e o fluxo de contato) mas nunca
// existiram como migration neste repo - foram adicionados direto em producao
// em algum momento nao documentado. Idempotente: on producao (onde as
// colunas ja existem) e um no-op.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const companiesDesc = (await queryInterface.describeTable(
      "Companies"
    )) as Record<string, unknown>;
    if (!companiesDesc.approved) {
      await queryInterface.addColumn("Companies", "approved", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
      });
    }

    const contactsDesc = (await queryInterface.describeTable(
      "Contacts"
    )) as Record<string, unknown>;
    if (!contactsDesc.isLid) {
      await queryInterface.addColumn("Contacts", "isLid", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Companies", "approved").catch(() => {});
    await queryInterface.removeColumn("Contacts", "isLid").catch(() => {});
  }
};
