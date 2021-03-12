export default(ctx) => {
  return {
    httpEndpoint: 'https://hasura-<YOUR ID>.nhost.app/v1/graphql',
    wsEndpoint: 'wss://hasura-<YOUR ID>.nhost.app/v1/graphql',
    getAuth: () => `Bearer ${
      ctx.$nhost.auth.getJWTToken()
    }`
  }
}
