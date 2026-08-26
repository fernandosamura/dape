import { QueryInterface } from "sequelize";

// Registra o modulo/feature-flag "whatsapp_coexistence" no catalogo ja
// existente de modulos DAPE. So o registro do catalogo - NAO adiciona em
// nenhum dape_plan_modules (nenhum plano concede automaticamente). So fica
// habilitado via override manual por empresa no painel admin ja existente
// (dapeMaster.controller.ts / dape_tenant_module_overrides), reaproveitando
// o mecanismo de feature flag ja usado pelos outros modulos DAPE.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      INSERT INTO dape_available_modules (module_key, module_name, description, icon, sort_order, is_active)
      VALUES (
        'whatsapp_coexistence',
        'WhatsApp Business + DAPLE',
        'Mantenha o WhatsApp Business App funcionando no celular e use o mesmo numero tambem pelo DAPLE, via API oficial da Meta.',
        'whatsapp',
        100,
        true
      )
      ON CONFLICT (module_key) DO NOTHING;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      DELETE FROM dape_available_modules WHERE module_key = 'whatsapp_coexistence';
    `);
  }
};
