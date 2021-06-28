import { createApp, provide, h } from "vue";
import App from "./App.vue";
import { generateNhostApolloClient } from "nhost-vue-apollo";
import { auth } from "./utils/nhost";
import { DefaultApolloClient } from "@vue/apollo-composable";
import router from "./router";
import store from "./utils/store";
import "./assets/styles.css";

const defaultClient = generateNhostApolloClient({
  gqlEndpoint: "https://hasura-5939b8f7.nhost.app/v1/graphql",
  auth,
}).client;

// Syncing values in our data store with nhost auth
auth.onAuthStateChanged((state) => {
  store.setSignedIn(state.valueOf());
});

createApp({
  setup() {
    provide(DefaultApolloClient, defaultClient);
  },
  render() {
    return h(App);
  },
})
  .use(router)
  .mount("#app");
