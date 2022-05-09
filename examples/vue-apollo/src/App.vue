<template>
  <v-app>
    <v-app-bar color="primary">
      <template #prepend>
        <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      </template>
      <template #append>
        <v-btn
          v-if="isAuthenticated"
          icon="mdi-exit-to-app"
          @click="() => signOut()"
        />
      </template>
    </v-app-bar>
    <v-navigation-drawer
      v-model="drawer"
      temporary
    />
    <v-main class="my-4">
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthenticated, useSignOut } from '@nhost/vue'
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
