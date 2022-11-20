import path from 'path'

import args from 'command-line-args'

import { generate } from '@graphql-codegen/cli'

const {
  origin,
  destination = path.join(origin, '_sdk.ts'),
  watch
} = args([
  { name: 'origin', alias: 'o', type: String, defaultValue: 'functions' },
  { name: 'destination', alias: 'd', type: String },
  { name: 'watch', alias: 'w', type: Boolean, defaultValue: false }
])

async function main() {
  const functionsDirectory = path.resolve(process.cwd(), origin)
  const generatedFile = path.resolve(process.cwd(), destination)
  await generate(
    {
      schema: [
        {
          'http://localhost:1337/v1/graphql': {
            headers: {
              'x-hasura-admin-secret': 'nhost-admin-secret'
            }
          }
        }
      ],
      documents: [`${functionsDirectory}/**/*.graphql`],
      generates: {
        [generatedFile]: {
          plugins: ['typescript', 'typescript-operations', 'typescript-graphql-request'],
          config: {
            namingConvention: {
              typeNames: 'change-case-all#pascalCase',
              transformUnderscore: true
            },
            gqlImport: 'graphql-request#gql'
          }
        }
      },
      watch
    },
    true
  )
}

main()
