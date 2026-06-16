'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface) => {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await queryInterface.bulkInsert('Users', [{
      id: 1,
      name: 'Admin Master',
      email: 'admin@admin.com',
      password: hashedPassword,
      profile: 'adminMaster',
      companyId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Users', null, {});
  }
};
