/**
 * @type {import("@gqty/cli").GQtyConfig}
 */
const config = {
  react: true,
  scalarTypes: { DateTime: 'string' },
  introspection: {
    endpoint: 'http://localhost:1337/v1/graphql',
    headers: {
      'x-hasura-admin-secret': 'nhost-admin-secret',
      'x-hasura-role': 'user'
    }
  },
  destination: './src/gqty/index.ts',
  subscriptions: false,
  javascriptOutput: false,
  enumsAsConst: false
}

module.exports = config
