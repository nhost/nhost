#!/bin/bash
set -e

echo "Running GraphQL code generator..."
pnpm graphql-codegen --config codegen.ts

GENERATED_TS_FILE="src/lib/graphql/__generated__/graphql.ts"
GENERATED_SCHEMA_FILE="schema.graphql"

if [ -f "$GENERATED_TS_FILE" ]; then
  echo "Fixing import in $GENERATED_TS_FILE..."
  # https://github.com/dotansimha/graphql-code-generator-community/issues/824
  sed -i -e 's/import type { useAuthenticatedFetcher }/import { useAuthenticatedFetcher }/g' "$GENERATED_TS_FILE"
  echo "Successfully removed \"type\" from useAuthenticatedFetcher import."
  echo "Formatting $GENERATED_TS_FILE..."
  biome check --write "$GENERATED_TS_FILE"
else
  echo "Error: Generated TypeScript file not found at $GENERATED_TS_FILE"
  exit 1
fi


if [ -f "$GENERATED_SCHEMA_FILE" ]; then
  echo "Formatting $GENERATED_SCHEMA_FILE..."
  biome check --write "$GENERATED_SCHEMA_FILE"
  echo "Successfully formatted $GENERATED_SCHEMA_FILE"
else
  echo "Warning: Generated schema file not found at $GENERATED_SCHEMA_FILE"
fi

echo "All tasks completed successfully."
