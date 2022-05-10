<template>
  <v-list nav>
    <v-list-item title="Home" to="/" value="home" prepend-icon="mdi-home" />
    <v-list-item title="Profile" to="/profile" value="profile" prepend-icon="mdi-account" />
    <v-list-item title="Apollo" to="/apollo" value="apollo" prepend-icon="mdi-api" />
    <v-list-item title="About" to="/about" value="about" prepend-icon="mdi-information" />
    <v-list-item v-if="authenticated" title="Sign out" prepend-icon="mdi-exit-to-app" @click="signOutHandler" />
  </v-list>
</template>
<script lang="ts">
import { useAuthenticated, useSignOut } from '@nhost/vue'
import { defineComponent } from 'vue'
import { useRouter } from 'vue-router'

export default defineComponent({
  setup() {
    const router = useRouter()
    const { signOut } = useSignOut()
    const authenticated = useAuthenticated()
    const signOutHandler = async () => {
      await signOut()
      router.push('/')
    }
    return {
      authenticated,
      signOutHandler
    }
  }
})
</script>
