module.exports = {
  extends: ['../../../config/.eslintrc.js', 'plugin:@next/next/recommended'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@next/next/no-server-import-in-page': 'off'
  }
}
