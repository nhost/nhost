import { defineConfig } from 'orval';

export default defineConfig({
  adminApi: {
    input: {
      target: 'openapi.yaml',
      filters: {
        mode: 'exclude',
        tags: ['migrations', 'metadata'],
        includeUnreferencedSchemas: true,
      },
    },
    output: {
      mode: 'tags-split',
      target: 'generated',
      schemas: 'generated/schemas',
      client: 'fetch',
      clean: true,
      formatter: 'biome',
    },
  },
});
