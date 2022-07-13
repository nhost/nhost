<template>
  <v-app>
    <v-app-bar color="primary">
      <template #prepend>
        <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      </template>
      <v-app-bar-title>Nhost with Vue and Apollo</v-app-bar-title>
      <template #append>
        <v-btn icon="mdi-github" href="https://github.com/nhost/nhost/tree/main/examples/vue-apollo" target="_blank" />
        <v-btn v-if="isAuthenticated" icon="mdi-exit-to-app" @click="signOutHandler" />
      </template>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer" permanent>
      <nav-bar />
    </v-navigation-drawer>
    <v-main class="my-4">
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthenticated, useSignOut } from '@nhost/vue'

import NavBar from './components/NavBar.vue'

const router = useRouter()
const isAuthenticated = useAuthenticated()
const { signOut } = useSignOut()
const drawer = ref(true)
const signOutHandler = async () => {
  await signOut()
  router.replace('/signout')
}
</script>
