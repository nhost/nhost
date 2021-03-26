export default(ctx) => {
  return {
    httpEndpoint: 'https://hasura-fcb83854.nhost.app/v1/graphql',
    wsEndpoint: 'wss://hasura-fcb83854.nhost.app/v1/graphql',
    getAuth: () => `Bearer ${
      ctx.$nhost.auth.getJWTToken()
    }`
  }
}
