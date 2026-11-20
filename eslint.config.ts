import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginAstro from 'eslint-plugin-astro'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/.claude/**', '**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/.astro/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // Fichiers .astro (frontmatter, gabarit, scripts). Doc : https://ota-meshi.github.io/eslint-plugin-astro/
  ...pluginAstro.configs['flat/recommended'],

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
  {
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // `audit()` (e2e/a11y.spec.ts) contient les assertions axe.
    rules: { 'playwright/expect-expect': ['warn', { assertFunctionNames: ['audit'] }] },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
