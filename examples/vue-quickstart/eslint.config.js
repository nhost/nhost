import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'
import baseEslintConfig from '../../config/eslint.config.base.js'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
  ...baseEslintConfig,
  includeIgnoreFile(gitignorePath),
  { files: ['**/*.{js,mjs,cjs,ts,vue}'], plugins: { js }, extends: ['js/recommended'] },
  { files: ['**/*.{js,mjs,cjs,ts,vue}'], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } }
])

// {
//   "root": true,
//   "extends": ["../../config/.eslintrc.vue.js", "@antfu"],
//   "rules": {
//     "@typescript-eslint/comma-dangle": "off",
//     "curly": "off",
//     "quote-props": "off",
//     "vue/html-self-closing": "off",
//     "vue/singleline-html-element-content-newline": "off",
//     "eol-last": "off",
//     "eslint-comments/no-unlimited-disable": "off"
//   }
// }
