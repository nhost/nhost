<template>
  <v-text-field v-model="email" label="Email" />
  <v-text-field v-model="password" label="Password" type="password" />
  <v-btn block color="primary" class="my-1" @click="signUp"> Sign up </v-btn>
  <v-btn class="my-1" block variant="text" color="primary" to="/signup">
    &#8592; Other registration Options!
  </v-btn>
  <error-snack-bar :error="error" />
  <verification-email-dialog v-model="emailVerificationDialog" :email="email" />

</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useSignUpEmailPassword } from '@nhost/vue'
const emailVerificationDialog = ref(false)
const email = ref('')
const password = ref('')
const { signUpEmailPassword, error } = useSignUpEmailPassword({
  redirectTo: window.location.origin
})

const signUp = async () => {
  const result = await signUpEmailPassword(email, password)
  if (result.needsEmailVerification) {
    emailVerificationDialog.value = true
  }
}


</script>
