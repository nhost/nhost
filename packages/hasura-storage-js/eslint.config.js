import globals from 'globals'
import tseslint from 'typescript-eslint'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'
import baseEslintConfig from '../../config/eslint.config.base.js'
import { defineConfig } from 'eslint/config'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
  ...baseEslintConfig,
  includeIgnoreFile(gitignorePath),
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended
])

// module.exports = {
//   extends: '../../config/.eslintrc.js',
//   parserOptions: {
//     project: 'tsconfig.json',
//     tsconfigRootDir: __dirname
//   }
// }
