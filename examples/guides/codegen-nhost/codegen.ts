import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: [
    {
      "https://local.graphql.local.nhost.run/v1": {
        headers: {
          "x-hasura-admin-secret": "nhost-admin-secret",
        },
      },
    },
  ],
  documents: ["src/lib/graphql/**/*.graphql"],
  ignoreNoDocuments: true,
  generates: {
    "./src/lib/graphql/__generated__/": {
      preset: "client",
      presetConfig: {
        persistedDocuments: false,
        fragmentMasking: false,
      },
      plugins: [
        {
          "./add-query-source-plugin.cjs": {},
        },
      ],
      config: {
        scalars: {
          UUID: "string",
          uuid: "string",
          timestamptz: "string",
          jsonb: "Record<string, any>",
          bigint: "number",
          bytea: "Buffer",
          citext: "string",
        },
        useTypeImports: true,
      },
    },
    "./schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
