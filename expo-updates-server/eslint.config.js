const { defineConfig } = require('eslint/config');
const universeNodeConfig = require('eslint-config-universe/flat/node');
const universeSharedTypescriptAnalysisConfig = require('eslint-config-universe/flat/shared/typescript-analysis');
const universeWebConfig = require('eslint-config-universe/flat/web');

module.exports = defineConfig([
  universeNodeConfig,
  universeWebConfig,
  universeSharedTypescriptAnalysisConfig,

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      parserOptions: {
        project: './tsconfig.json',
      },
    },

    rules: {
      'handle-callback-err': 'off',
      '@typescript-eslint/no-redeclare': 'off',
    },
  },
]);
