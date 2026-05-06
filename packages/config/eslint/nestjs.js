// @ts-check
const baseConfig = require('./base');

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
const nestjsConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // NestJS uses decorators extensively; these are expected patterns
      '@typescript-eslint/no-extraneous-class': 'off',
      // Controllers/guards/interceptors often have injected deps with no direct use
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];

module.exports = nestjsConfig;
