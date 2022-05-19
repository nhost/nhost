<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthenticated, useSignOut } from '@nhost/vue'
import { isDark, toggleDark } from '~/composables'
const isAuthenticated = useAuthenticated()
const { signOut } = useSignOut()
const router = useRouter()
const handleSignOut = () => {
  signOut()
  router.push('/')
}
</script>

<template>
  <nav text-xl mt-6 inline-flex gap-2>
    <button class="icon-btn !outline-none" @click="toggleDark()">
      <div v-if="isDark" i-carbon-moon />
      <div v-else i-carbon-sun />
    </button>

    <button v-if="isAuthenticated" class="icon-btn !outline-none" @click="handleSignOut">
      <div i-carbon-logout />
    </button>
  </nav>
</template>
