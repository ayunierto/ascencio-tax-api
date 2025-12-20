// eslint.config.js
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import nestjsPlugin from '@darraghor/eslint-plugin-nestjs-typed'; // Optional: for NestJS-specific rules

export default defineConfig([
  tseslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier,
      '@darraghor/nestjs-typed': nestjsPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
]);
