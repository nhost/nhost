module.exports = {
  root: true,
  extends: ['../../config/.eslintrc.vue.js', '@antfu'],
  rules: {
    '@typescript-eslint/comma-dangle': 'off',
    curly: 'off',
    'quote-props': 'off',
    'vue/html-self-closing': 'off',
    'vue/singleline-html-element-content-newline': 'off'
  }
}
