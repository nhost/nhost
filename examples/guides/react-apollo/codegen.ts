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
  documents: ["src/**/*.ts"],
  ignoreNoDocuments: true,
  generates: {
    "./src/lib/graphql/__generated__/graphql.ts": {
      documents: ["src/lib/graphql/**/*.graphql"],
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-react-apollo",
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
