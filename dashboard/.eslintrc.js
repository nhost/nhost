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
  ignorePatterns: [
    '**/.eslintrc.js',
    '**/prettier.config.js',
    '**/next.config.js',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': [2, { ignore: ['className'] }],
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
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    curly: ['error', 'all'],
    'no-undef': 'off',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { ignoreTypeReferences: true },
    ],
    'no-console': ['warn', { allow: ['error'] }],
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
              'Please use absolute imports instead. (e.g: @/components/, @/hooks/, etc.)',
          },
          {
            group: ['@testing-library/react*'],
            message: 'Please use @/tests/testUtils instead.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/components/ui/v3/*.tsx'],
      rules: {
        'react/prop-types': [
          2,
          {
            ignore: [
              'className',
              'align',
              'sideOffset',
              'orientation',
              'decorative',
              'checked',
              'position',
            ],
          },
        ],
        'react-refresh/only-export-components': 'off',
        'react/function-component-definition': 'off',
        'arrow-body-style': 'off',
        'react/no-unknown-property': 'off',
      },
    },
  ],
};
