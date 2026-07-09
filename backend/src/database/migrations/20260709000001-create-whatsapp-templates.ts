import { QueryInterface, DataTypes } from "sequelize";

// #031 Meta Cloud API - Fase E: templates de mensagem aprovados pela Meta,
// necessarios pra campanhas via Cloud API (mensagem de negocio fora da
// janela de 24h exige template pre-aprovado).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes("WhatsappTemplates")) {
      await queryInterface.createTable("WhatsappTemplates", {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        whatsappId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Whatsapps", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        metaTemplateId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        language: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "pt_BR"
        },
        category: {
          type: DataTypes.STRING,
          allowNull: true
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "PENDING"
        },
        bodyText: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        components: {
          type: DataTypes.JSONB,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      });

      await queryInterface.addIndex("WhatsappTemplates", ["whatsappId"]);
      await queryInterface.addIndex("WhatsappTemplates", ["companyId"]);
    }

    const campaignTableDesc = (await queryInterface.describeTable(
      "Campaigns"
    )) as Record<string, unknown>;
    if (!campaignTableDesc.templateId) {
      await queryInterface.addColumn("Campaigns", "templateId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "WhatsappTemplates", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Campaigns", "templateId").catch(() => {});
    await queryInterface.dropTable("WhatsappTemplates").catch(() => {});
  }
};
