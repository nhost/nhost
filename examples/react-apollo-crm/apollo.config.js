module.exports = {
  client: {
    service: {
      name: "backend",
      url: "http://localhost:1337/v1/graphql",
      headers: {
        "x-hasura-admin-secret": "nhost-admin-secret",
      },
    },
    includes: ["src/**/*.graphql", "src/**/*.gql"],
  },
};
