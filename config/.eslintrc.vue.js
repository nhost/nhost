const base = require('./.eslint.base')
module.exports = {
  ...base,
  extends: ['plugin:import/recommended', 'plugin:import/typescript'],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ...base.parserOptions,
    parser: '@typescript-eslint/parser'
  }
}
