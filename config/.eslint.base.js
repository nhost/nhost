module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true
  },
  ignorePatterns: [
    'dist',
    'umd',
    'build',
    '.next',
    'node_modules',
    'tsup.config.ts',
    '__tests__',
    '__mocks__',
    '*.test.ts',
    '*.test.tsx',
    '*.spec.ts',
    '*.spec.tsx',
    'tests/**/*.ts',
    'tests/**/*.d.ts',
    'e2e/**/*.ts',
    'e2e/**/*.d.ts'
  ],
  plugins: ['@typescript-eslint'],
  extends: [],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  rules: {
    'react/prop-types': 'off',
    'no-use-before-define': 'off',
    'import/no-anonymous-default-export': [
      'error',
      {
        allowArrowFunction: true,
        allowAnonymousFunction: true
      }
    ]
  }
}
