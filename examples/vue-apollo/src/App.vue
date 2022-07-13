<template>
  <v-app>
    <v-app-bar color="primary">
      <template #prepend>
        <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      </template>
      <template #append>
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
return {
  drawer,
  isAuthenticated,
  signOutHandler
}
</script>
