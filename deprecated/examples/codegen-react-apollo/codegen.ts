import { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: [
    {
      'http://localhost:1337/v1/graphql': {
        headers: {
          'x-hasura-admin-secret': 'nhost-admin-secret'
        }
      }
    }
  ],
  ignoreNoDocuments: true, // for better experience with the watcher
  generates: {
    './src/gql/': {
      documents: ['src/**/*.tsx'],
      preset: 'client',
      plugins: []
    }
  }
}

export default config
