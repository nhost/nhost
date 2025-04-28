import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
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
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended
])

// import js from '@eslint/js'
// import globals from 'globals'
// import reactHooks from 'eslint-plugin-react-hooks'
// import reactRefresh from 'eslint-plugin-react-refresh'
// import tseslint from 'typescript-eslint'
//
// export default tseslint.config({
//   extends: [js.configs.recommended, ...tseslint.configs.recommended],
//   files: ['**/*.{ts,tsx}'],
//   ignores: ['dist'],
//   languageOptions: {
//     ecmaVersion: 2020,
//     globals: globals.browser,
//   },
//   plugins: {
//     'react-hooks': reactHooks,
//     'react-refresh': reactRefresh,
//   },
//   rules: {
//     ...reactHooks.configs.recommended.rules,
//     'react-refresh/only-export-components': [
//       'warn',
//       { allowConstantExport: true },
//     ],
//   },
// })
