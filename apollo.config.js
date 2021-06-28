module.exports = {
  client: {
    service: {
      name: "Hasura Auth",
      url: "http://localhost:8080/v1/graphql",
      headers: {
        "x-hasura-admin-secret": "hello123",
      },
    },
    includes: ["src/**/*.graphql"],
  },
};
