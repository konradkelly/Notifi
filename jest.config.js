// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/tests/**/*.test.js', '**/?(*.)+(spec|test).js'],
  clearMocks: true,
};