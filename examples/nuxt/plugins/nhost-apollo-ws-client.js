export default(ctx) => {
  const subscriptionClient = ctx.app.apolloProvider.defaultClient.wsClient;

  ctx.$nhost.auth.onAuthStateChanged((state) => {
    if (subscriptionClient.status === 1) {
      subscriptionClient.close();
      subscriptionClient.tryReconnect();
    }
  });

  ctx.$nhost.auth.onTokenChanged(() => {
    if (subscriptionClient.status === 1) {
      subscriptionClient.tryReconnect();
    }
  })
}
