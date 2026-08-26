import { QueryInterface, DataTypes } from "sequelize";

// Tabela de observacao/idempotencia para os webhooks de Coexistence
// (history, smb_app_state_sync, smb_message_echoes) - fase "so observar",
// sem side-effect em Message/Ticket.
//
// dedupKey e sempre preenchido pela aplicacao: usa o id oficial da Meta
// quando o evento trouxer um, ou um fallback deterministico quando nao
// trouxer (algoritmo do fallback e decidido em codigo na Etapa 5, so
// depois de observar payloads reais - nao definido aqui).
//
// A idempotencia e isolada POR CONEXAO (whatsappId + eventType + dedupKey),
// nao globalmente - dois numeros diferentes podem coincidentemente gerar
// o mesmo dedupKey sem colidir entre si.
//
// companyId e mantido mesmo existindo relacao via whatsappId, para
// isolamento multi-tenant/auditoria/consultas diretas. O codigo que grava
// aqui (Etapa 5) DEVE validar Whatsapp.companyId === companyId recebido
// antes de persistir - nunca confiar em companyId vindo de payload externo.
//
// payloadMeta (JSONB, nullable) so pode conter metadata tecnica minima
// (tipo de evento, timestamp, phoneNumberId etc). NUNCA: conteudo/texto de
// mensagem, midia, access token, authorization code, CPF/CNPJ, nome ou
// telefone do contato (salvo se tecnicamente indispensavel no futuro), ou
// o payload bruto do webhook.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("dape_coexistence_events")) return;

    await queryInterface.createTable("dape_coexistence_events", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      eventType: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      externalEventId: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      dedupKey: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      payloadMeta: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex("dape_coexistence_events", ["whatsappId"]);
    await queryInterface.addIndex(
      "dape_coexistence_events",
      ["whatsappId", "eventType", "dedupKey"],
      { unique: true, name: "dape_coexistence_events_whatsapp_type_dedup_unique" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("dape_coexistence_events")) {
      await queryInterface.dropTable("dape_coexistence_events");
    }
  }
};
