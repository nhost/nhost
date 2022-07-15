<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-title>Sign in to the Application</v-card-title>
      <v-card-text>
        <router-view />
      </v-card-text>
    </v-card>
    <v-divider class="my-4" style="min-width: 90%" />
    <div>
      Don&lsquo;t have an account? <router-link to="/signup"> Sign up </router-link> or
      <a v-if="!isLoading" href="#" @click="handleSignInAnonymous">sign in anonymously</a>
      <v-progress-circular v-else indeterminate />
    </div>
  </div>
  <error-snack-bar :error="error" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useSignInAnonymous } from '@nhost/vue'
const { signInAnonymous, error, isLoading } = useSignInAnonymous()
const router = useRouter()
const handleSignInAnonymous = async (e: Event) => {
  e.preventDefault()
  const { isSuccess } = await signInAnonymous()
  if (isSuccess) {
    router.push('/profile')
  }
}
</script>