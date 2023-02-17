require('dotenv').config();
module.exports = {
  client: {
    service: {
      name: 'Hasura Auth',
      url: process.env.HASURA_GRAPHQL_GRAPHQL_URL,
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET,
      },
    },
    includes: ['src/**/*.graphql'],
  },
};
