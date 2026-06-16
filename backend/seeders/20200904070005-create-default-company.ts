'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('Companies', [{
      id: 1,
      name: 'Empresa Padrão',
      status: true,
      planId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Companies', null, {});
  }
};
