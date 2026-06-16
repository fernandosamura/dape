'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Companies', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.BOOLEAN, defaultValue: true },
      planId: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      profile: { type: Sequelize.STRING, defaultValue: 'admin' },
      companyId: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Plans', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING },
      users: { type: Sequelize.INTEGER },
      connections: { type: Sequelize.INTEGER },
      queues: { type: Sequelize.INTEGER },
      value: { type: Sequelize.FLOAT },
      useCampaigns: { type: Sequelize.BOOLEAN },
      useExternalApi: { type: Sequelize.BOOLEAN },
      useInternalChat: { type: Sequelize.BOOLEAN },
      useSchedules: { type: Sequelize.BOOLEAN },
      useKanban: { type: Sequelize.BOOLEAN },
      useOpenAi: { type: Sequelize.BOOLEAN },
      useIntegrations: { type: Sequelize.BOOLEAN },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Plans');
    await queryInterface.dropTable('Users');
    await queryInterface.dropTable('Companies');
  }
};
