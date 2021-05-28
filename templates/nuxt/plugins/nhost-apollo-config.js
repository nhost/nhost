export default ctx => {
  return {
    httpEndpoint: process.env.NHOST_GRAPHQL_ENDPOINT,
    wsEndpoint: process.env.NHOST_GRAPHQL_ENDPOINT.includes("https")
      ? process.env.NHOST_GRAPHQL_ENDPOINT.replace("https", "wss")
      : process.env.NHOST_GRAPHQL_ENDPOINT.replace("http", "ws"),
    getAuth: () => `Bearer ${ctx.$nhost.auth.getJWTToken()}`
  };
};
