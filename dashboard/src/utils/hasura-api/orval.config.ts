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
      client: 'react-query',
      prettier: true,
      override: {
        mutator: {
          path: './hasura-mutator.ts',
          name: 'hasuraMutator',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: false,
        },
      },
    },
  },
});
