// ESLint 9 flat config. Replaces the legacy .eslintrc.json, which ESLint v9
// no longer supports. `npm run lint` globs src/**/*.ts (see package.json).
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/', 'node_modules/', 'src/prisma/migrations/', 'frontend/'],
  },
  js.configs.recommended,
  // Bundles the @typescript-eslint parser, plugin, and recommended ruleset.
  ...tseslint.configs['flat/recommended'],
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
