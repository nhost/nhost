module.exports = {
  client: {
    service: {
      name: "Hasura Auth",
      url: "http://localhost:8080/v1/graphql",
      headers: {
        "x-hasura-admin-secret": "a_long_secret_that_should_never_be_used_in_production",
      },
    },
    includes: ["src/**/*.graphql"],
  },
};
