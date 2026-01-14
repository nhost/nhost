import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      '**/__generated__/',
      'src/utils/hasura-api/generated/',
      '**/eslint.config.mjs',
      '**/prettier.config.js',
      '**/next.config.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
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
  },
  {
    files: ['src/tests/testUtils.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['..*'],
              message:
                'Please use absolute imports instead. (e.g: @/components/, @/hooks/, etc.)',
            },
          ],
        },
      ],
    },
  },
]);
