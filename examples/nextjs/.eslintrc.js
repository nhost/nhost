module.exports = {
  extends: [
    '../../config/.eslintrc.js',
    'plugin:react/jsx-runtime',
    'plugin:@next/next/recommended'
  ],
  rules: {
    'react/react-in-jsx-scope': 'off'
  }
}
