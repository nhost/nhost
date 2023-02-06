/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next', 'airbnb', 'airbnb-typescript', 'airbnb/hooks', 'prettier'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  ignorePatterns: ['**/.eslintrc.js', '**/prettier.config.js'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/require-default-props': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'import/order': 'off',
    'import/extensions': ['error', 'never', { json: 'always' }],
    'react/jsx-filename-extension': ['warn', { extensions: ['.jsx', '.tsx'] }],
    'react/jsx-no-bind': [
      'error',
      { allowArrowFunctions: true, allowFunctions: true },
    ],
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    curly: ['error', 'all'],
    'no-restricted-exports': 'off',
    'no-undef': 'off',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { ignoreTypeReferences: true },
    ],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false,
        },
      },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports' },
    ],
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['..*'],
            message:
              'Please use absolute imports instead. (e.g: @/ui/, @/hooks/, etc.)',
          },
          {
            group: ['@/components/ui', '@/components/ui/*'],
            message:
              'Please use shorthand imports instead. (e.g: @/ui/ActivityIndicator, @/ui/Button, etc.)',
          },
          {
            group: ['@/components/ui/v2*'],
            message:
              'Please use shorthand imports instead. (e.g: @/ui/v2/ActivityIndicator, @/ui/v2/Button, etc.)',
          },
          {
            group: ['@testing-library/react*'],
            message: 'Please use @/utils/testUtils instead.',
          },
        ],
      },
    ],
  },
};
