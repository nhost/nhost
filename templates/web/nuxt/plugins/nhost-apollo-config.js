export default ctx => {
  return {
    httpEndpoint: process.env.NHOST_BACKEND_URL + "/v1/graphql",
    wsEndpoint: process.env.NHOST_BACKEND_URL.includes("https")
      ? process.env.NHOST_BACKEND_URL.replace("https", "wss") + "/v1/graphql"
      : process.env.NHOST_BACKEND_URL.replace("http", "ws") + "/v1/graphql",
    getAuth: () => `Bearer ${ctx.$nhost.auth.getJWTToken()}`
  };
};
