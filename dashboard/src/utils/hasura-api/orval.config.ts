import { defineConfig } from 'orval';

export default defineConfig({
  adminApi: {
    input: {
      target: 'openapi.yaml',
      filters: {
        mode: 'exclude',
        tags: ['migrations', 'metadata'],
      },
    },
    output: {
      mode: 'tags-split',
      target: 'generated',
      schemas: 'generated/schemas',
      client: 'fetch',
      formatter: 'biome',
      clean: true,
    },
  },
});
