export default ctx => {
  return {
    httpEndpoint: process.env.NHOST_GRAPHQL_ENDPOINT,
    wsEndpoint: process.env.NHOST_GRAPHQL_ENDPOINT.includes("wss")
      ? process.env.NHOST_GRAPHQL_ENDPOINT.replace("wss", "https")
      : process.env.NHOST_GRAPHQL_ENDPOINT.replace("ws", "http"),
    getAuth: () => `Bearer ${ctx.$nhost.auth.getJWTToken()}`
  };
};
