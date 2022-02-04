import { ESLintConfig } from '@beemo/driver-eslint'

const config: ESLintConfig = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:promise/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
    'plugin:react-hooks/recommended'
  ],
  env: {
    browser: true,
    node: true
  },
  rules: {
    '@typescript-eslint/no-implicit-any-catch': 'off',
    'sort-keys': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],

    'import/prefer-default-export': 'off',
    'import/no-default-export': 'error',
    'import/no-unresolved': ['error', { ignore: ['unist', 'mdast'] }],

    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': 'off',

    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error'
  },
  plugins: ['simple-import-sort'],

  overrides: [
    {
      files: ['{packages,examples,backend}/**/*.js', '{packages,examples,backend}/**/*.mjs'],
      rules: {
        'global-require': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/naming-convention': 'off',
        'import/no-default-export': 'off'
      }
    },
    {
      files: ['**/vue/**/*.tsx'],
      rules: {
        'react-hooks/rules-of-hooks': 'off'
      }
    }
  ],
  settings: {
    react: {
      version: 'detect'
    }
  }
}

export default config
