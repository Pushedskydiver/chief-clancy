import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
// boundaries v6 types don't export a valid ESLint Plugin shape
import * as _boundaries from 'eslint-plugin-boundaries';
import functional from 'eslint-plugin-functional';
import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const boundaries = _boundaries as Record<string, unknown>;

export default defineConfig(
  // ── Base configs ──────────────────────────────────────────────
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,

  // ── Global ignores ────────────────────────────────────────────
  {
    ignores: ['**/dist/', 'node_modules/', '.claude/hooks/', '**/bin/'],
  },

  // ── All TypeScript files ──────────────────────────────────────
  {
    files: ['packages/*/src/**/*.ts'],
    plugins: {
      functional,
      sonarjs,
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'packages/core/*' },
        { type: 'brief', pattern: 'packages/brief/*' },
        { type: 'plan', pattern: 'packages/plan/*' },
        { type: 'dev', pattern: 'packages/dev/*' },
        { type: 'terminal', pattern: 'packages/terminal/*' },
        { type: 'chat', pattern: 'packages/chat/*' },
        { type: 'wrapper', pattern: 'packages/chief-clancy/*' },
      ],
    },
    rules: {
      // ── TypeScript ──────────────────────────────────────────
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // ── Complexity limits ───────────────────────────────────
      complexity: ['error', 10],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', 3],
      'max-depth': ['error', 3],

      // ── Functional rules ────────────────────────────────────
      'functional/no-let': 'error',
      'functional/immutable-data': [
        'error',
        {
          ignoreImmediateMutation: true,
          ignoreClasses: true,
        },
      ],
      'functional/prefer-readonly-type': ['warn', { allowLocalMutation: true }],
      'functional/no-loop-statements': 'warn',

      // ── Architecture boundaries ─────────────────────────────
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              // Temporary: core → dev allowed for lifecycle re-exports + pipeline
              // phase imports. Removed when pipeline phases move to dev.
              from: { type: 'core' },
              allow: [{ to: { type: 'core' } }, { to: { type: 'dev' } }],
            },
            {
              from: { type: 'brief' },
              allow: [{ to: { type: 'brief' } }],
            },
            {
              from: { type: 'plan' },
              allow: [{ to: { type: 'plan' } }],
            },
            {
              from: { type: 'dev' },
              allow: [{ to: { type: 'dev' } }, { to: { type: 'core' } }],
            },
            {
              from: { type: 'terminal' },
              allow: [
                { to: { type: 'terminal' } },
                { to: { type: 'core' } },
                { to: { type: 'dev' } },
              ],
            },
            {
              from: { type: 'chat' },
              allow: [{ to: { type: 'chat' } }, { to: { type: 'core' } }],
            },
            {
              from: { type: 'wrapper' },
              allow: [
                { to: { type: 'wrapper' } },
                { to: { type: 'terminal' } },
                { to: { type: 'plan' } },
              ],
            },
          ],
        },
      ],
    },
  },

  // ── Test file overrides ───────────────────────────────────────
  {
    files: ['packages/*/src/**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      'functional/immutable-data': 'off',
      'functional/no-let': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
);
