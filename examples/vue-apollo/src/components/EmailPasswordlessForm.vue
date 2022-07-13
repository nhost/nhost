<template>
  <div>
    <v-text-field v-model="email" placeholder="Email Address" autofocus />
    <v-btn block color="primary" @click="signIn"> Continue with email </v-btn>
    <error-snack-bar :error="error" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

import { useSignInEmailPasswordless } from '@nhost/vue'

const email = ref('')
const { signInEmailPasswordless, error } = useSignInEmailPasswordless({
  redirectTo: '/#/profile'
})

const signIn = () => signInEmailPasswordless(email)
</script>
