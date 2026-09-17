import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  generates: {
    'src/gql/': {
      preset: 'client',
      config: {
        useTypeImports: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
