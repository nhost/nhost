module.exports = {
  extends: '../../.eslintrc.js',
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    'tsup.config.ts',
    'jest.config.ts'
  ],
  parserOptions: {
    project: ['./tsconfig.json']
  },
  plugins: ['@typescript-eslint', 'simple-import-sort'],
  rules: {
    // we are already using a Prettier formatter and this rule is conflicting
    // with it
    'simple-import-sort/imports': 'off'
  }
}
