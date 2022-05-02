<template>
  <v-app>
    <v-app-bar color="primary">
      <template v-slot:prepend>
        <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      </template>
      <template v-slot:append>
        <v-btn v-if="isAuthenticated" icon="mdi-exit-to-app" @click="() => signOut()"></v-btn>
      </template>
    </v-app-bar>
    <v-navigation-drawer v-model="drawer" temporary></v-navigation-drawer>
    <v-main class="my-4">
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { useAuthenticated, useSignOut } from '@nhost/vue'
import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
export default defineComponent({
  setup() {
    const router = useRouter()
    const isAuthenticated = useAuthenticated()
    const { signOut: signOutHandler } = useSignOut()
    const drawer = ref(false)
    const signOut = async () => {
      await signOutHandler()
      router.replace('/signout')
    }
    return {
      drawer,
      isAuthenticated,
      signOut
    }
  }
})
</script>
