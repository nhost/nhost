<template>
  <form @submit="handleSignIn">
    <v-text-field v-model="email" label="Email" />
    <v-text-field v-model="password" label="Password" type="password" />
    <v-btn
      block
      color="primary"
      class="my-1"
      type="submit"
      :disabled="isLoading"
      :loading="isLoading"
    >
      Sign in
    </v-btn>
  </form>
  <v-btn class="my-1" block variant="text" color="primary" to="/signin/forgot-password">
    Forgot password?
  </v-btn>
  <v-btn class="my-1" block variant="text" color="primary" to="/signin">
    &#8592; Other Sign-in Options
  </v-btn>
  <error-snack-bar :error="error" />
  <verification-email-dialog v-model="emailVerificationDialog" :email="email" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSignInEmailPassword } from '@nhost/vue'

const email = ref('')
const password = ref('')
const emailVerificationDialog = ref(false)

const router = useRouter()
const { signInEmailPassword, error, isLoading } = useSignInEmailPassword()

const handleSignIn = async (e: Event) => {
  e.preventDefault()
  const { isSuccess, needsEmailVerification } = await signInEmailPassword(email, password)
  if (isSuccess) {
    router.replace('/')
  }
  if (needsEmailVerification) {
    emailVerificationDialog.value = true
  }
}
</script>
