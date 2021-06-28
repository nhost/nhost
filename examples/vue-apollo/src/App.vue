<template>
  <nhost-image-vue></nhost-image-vue>
  <!-- Only showing rest of the app once auth has loaded. -->
  <!-- When null, auth has not loaded. -->
  <router-view v-if="store.state.isSignedIn !== null" />
  <loading-screen v-else />
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>

<script>
import store from "./utils/store";
import LoadingScreen from "./components/LoadingScreen.vue";
import NhostImageVue from "./components/NhostImage.vue";

export default {
  setup() {
    return {
      store,
    };
  },
  components: {
    LoadingScreen,
    NhostImageVue,
  },
};
</script>
