import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';
import tseslint from 'typescript-eslint';

const rootConfigFiles = ['eslint.config.mjs', 'jest.config.js'];

export default tseslint.config(
  { ignores: ['dist/**', 'dist-dev/**', 'coverage/**', 'node_modules/**'] },
  // apply default config
  prettierConfig,
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  // default language/parser options
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: rootConfigFiles,
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  // individual rule overrides
  {
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  // jest-specific config for tests
  {
    files: ['src/**/*.test.ts', 'src/__tests__/**/*.ts'],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
    },
  },
  // disable type checking for root config files
  {
    files: rootConfigFiles,
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { sourceType: 'commonjs' },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
