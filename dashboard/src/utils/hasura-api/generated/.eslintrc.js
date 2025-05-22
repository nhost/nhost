module.exports = {
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    'arrow-body-style': 'off',
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'prettier/prettier': [
          'error',
          {
            singleQuote: true,
            semi: true,
            trailingComma: 'all',
          },
        ],
      },
    },
  ],
};
