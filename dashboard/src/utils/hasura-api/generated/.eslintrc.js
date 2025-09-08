module.exports = {
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    'arrow-body-style': 'off',
    'no-restricted-imports': 'off',
    'import/no-self-import': 'off',
    'import/no-useless-path-segments': 'off',
  },
  overrides: [
    {
      files: ['*.ts'],
    },
  ],
};
