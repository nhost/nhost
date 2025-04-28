import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'
import baseEslintConfig from '../../config/eslint.config.base.js'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
  ...baseEslintConfig,
  includeIgnoreFile(gitignorePath),
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], plugins: { js }, extends: ['js/recommended'] },
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended
])

// const base = require('../../config/.eslintrc.js')
// module.exports = {
//   ...base,
//   parserOptions: {
//     project: 'tsconfig.json',
//     tsconfigRootDir: __dirname
//   },
//   ignorePatterns: [...base.ignorePatterns, 'functions/**/*.ts']
// }
