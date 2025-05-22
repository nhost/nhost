import { defineConfig } from 'orval';

export default defineConfig({
  hasuraApi: {
    input: {
      target: 'openapi.yaml',
    },
    output: {
      mode: 'tags-split',
      target: 'generated',
      schemas: 'generated/schemas',
      client: 'fetch',
      override: {
        mutator: {
          path: 'custom-fetch.ts',
          name: 'customFetch',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
        operations: {
          metadataOperation: {
            // Handle the remote schemas operation
            operationName: () => 'executeMetadataOperation',
          },
        },
      },
      prettier: true,
    },
    hooks: {
      afterAllFilesWrite: {
        command: 'npx prettier --write "./src/utils/hasura-api/generated/**/*.ts"',
      },
    },
  },
});
