<template>
  <form @submit="handleSignIn">
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
  <v-btn class="my-1" block variant="text" color="primary" to="/signin">
    &#8592; Other Sign-in Options
  </v-btn>
  <error-snack-bar :error="error" />
  <verification-email-dialog v-model="emailVerificationDialog" :email="email" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSignInSecurityKey } from '@nhost/vue'
const emailVerificationDialog = ref(false)

const router = useRouter()
const { signInSecurityKey, error, isLoading } = useSignInSecurityKey()

const handleSignIn = async (e: Event) => {
  e.preventDefault()
  const { isSuccess, needsEmailVerification } = await signInSecurityKey()
  if (isSuccess) {
    router.replace('/')
  }
  if (needsEmailVerification) {
    emailVerificationDialog.value = true
  }
}
</script>
