import js from '@eslint/js'
import path from 'node:path'
import tseslint from 'typescript-eslint'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.gitignore')
const eslintignorePath = fileURLToPath(new URL('.eslintignore', import.meta.url))

export default [
  includeIgnoreFile(gitignorePath),
  includeIgnoreFile(eslintignorePath),
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], plugins: { js }, extends: ['js/recommended'] },
  tseslint.configs.recommended
]
