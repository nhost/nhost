import globals from 'globals'
import pluginReact from 'eslint-plugin-react'
import { defineConfig } from 'eslint/config'
import baseEslintConfig from '../../config/eslint.config.base.js'

export default defineConfig([
  ...baseEslintConfig,
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], languageOptions: { globals: globals.browser } },
  pluginReact.configs.flat.recommended
])

// module.exports = {
//   extends: '../../config/.eslintrc.js',
//   parserOptions: {
//     project: 'tsconfig.json',
//     tsconfigRootDir: __dirname
//   }
// }
