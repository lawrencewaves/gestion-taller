// Reglas de calidad y límites entre capas (ARCHITECTURE §2).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const platform = ['@tauri-apps/*', '@sqlite.org/*'];

/** Paquetes que cada capa NO puede importar. */
const forbid = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'design/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...forbid(
        [...platform, '@gonzalvo/core', '@gonzalvo/core/*', '@gonzalvo/data', '@gonzalvo/data/*', '@gonzalvo/adapter-*'],
        'La interfaz solo habla con @gonzalvo/contracts (ARCHITECTURE §2).',
      ),
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: forbid(
      [...platform, 'react', 'react-dom', '@gonzalvo/ui', '@gonzalvo/web', '@gonzalvo/adapter-*'],
      'core no depende de ninguna plataforma ni de la interfaz (ARCHITECTURE §2).',
    ),
  },
  {
    files: ['packages/data/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: forbid(
      [...platform, 'react', 'react-dom', '@gonzalvo/ui', '@gonzalvo/web', '@gonzalvo/adapter-*'],
      'data solo habla SQL a través del puerto SqlExecutor (ARCHITECTURE §2).',
    ),
  },
  {
    files: ['packages/contracts/**/*.ts'],
    rules: forbid(
      [...platform, 'react', 'react-dom', '@gonzalvo/*'],
      'contracts solo define tipos y esquemas compartidos (ARCHITECTURE §5).',
    ),
  },
);
