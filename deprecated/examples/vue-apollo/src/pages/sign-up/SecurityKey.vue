<template>
  <form @submit="handleSignUp">
    <v-text-field v-model="email" label="Email" />
    <v-btn
      block
      color="primary"
      class="my-1"
      type="submit"
      :disabled="isLoading"
      :loading="isLoading"
    >
      Sign up
    </v-btn>
  </form>
  <v-btn class="my-1" block variant="text" color="primary" to="/signup">
    &#8592; Other registration Options!
  </v-btn>
  <error-snack-bar :error="error" />
  <verification-email-dialog v-model="emailVerificationDialog" :email="email" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useSignUpEmailSecurityKey } from '@nhost/vue'
import { useRouter } from 'vue-router'

const email = ref('')
const emailVerificationDialog = ref(false)

const router = useRouter()

const { error, isLoading, signUpEmailSecurityKey } = useSignUpEmailSecurityKey()

const handleSignUp = async (e: Event) => {
  e.preventDefault()

  const { isSuccess, needsEmailVerification } = await signUpEmailSecurityKey(email)

  if (isSuccess) {
    router.replace('/')
  }

  if (needsEmailVerification) {
    emailVerificationDialog.value = true
  }
}
</script>
