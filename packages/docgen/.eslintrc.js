module.exports = {
  extends: '../../config/.eslintrc.js',
  plugins: ['@typescript-eslint', 'simple-import-sort'],
  rules: {
    // we are already using a Prettier formatter and this rule is conflicting
    // with it
    'simple-import-sort/imports': 'off'
  }
}
