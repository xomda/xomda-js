import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import storybook from 'eslint-plugin-storybook'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // demo/* `output/` directories are gitignored generator artifacts.
      'demo/*/output/**',
      // Worktree clones live under .claude/worktrees; lint them in their own root.
      '.claude/worktrees/**',
      // Build outputs and generated code are never the source of truth.
      '**/build/**',
      '**/target/**',
      '**/out/**',
      'generated/**',
      // @xomda/icons: auto-emitted by scripts/generate.ts on postinstall.
      // Source of truth is the generator + src/aliases.ts.
      'packages/icons/src/index.ts',
      'packages/icons/src/icons/devicons.ts',
      'packages/icons/src/icons/material/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'prefer-template': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  // Storybook story files — scoped so the plugin's rules don't bleed into
  // production code (AGENTS.md §16 + docs/code-review.md §17).
  {
    files: ['**/*.stories.{ts,tsx}'],
    plugins: { storybook },
    rules: storybook.configs['flat/recommended'].at(-1).rules,
  },
  // Prettier must be last so its formatting rules win against any config
  // entry above (docs/code-review.md §17).
  prettierConfig
)
