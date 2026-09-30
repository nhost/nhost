import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  generates: {
    'src/gql/': {
      preset: 'client',
      config: {
        useTypeImports: true,
        scalars: {
          citext: 'string',
          jsonb: 'unknown',
          timestamptz: 'string',
          uuid: 'string',
        },
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
