<script setup lang="ts">
import { useAuthenticationStatus } from '@nhost/vue'
const { isAuthenticated, isLoading } = useAuthenticationStatus()
</script>

<template>
  <div>
    <div i-carbon-home text-4xl inline-block />
    <p>Vue with Nhost</p>
    <p>
      <em text-sm op75>Quickstart</em>
    </p>
    <div py-4 />
    <div v-if="isLoading">
      Loading...
    </div>
    <div v-else-if="isAuthenticated">
      Authenticated user
    </div>
    <div v-else>
      <router-link class="btn" to="/sign-up">
        Sign Up
      </router-link><br>
      <router-link class="btn" to="/sign-in">
        Sign In
      </router-link>
    </div>
  </div>
</template>
