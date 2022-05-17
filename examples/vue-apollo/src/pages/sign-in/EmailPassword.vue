<template>
  <v-text-field
    v-model="email"
    label="Email"
  />
  <v-text-field
    v-model="password"
    label="Password"
    type="password"
  />
  <v-btn
    block
    color="primary"
    class="my-1"
    @click="signIn"
  >
    Sign in
  </v-btn>
  <v-btn
    class="my-1"
    block
    variant="text"
    color="primary"
    to="/signin"
  >
    &#8592; Other Login Options
  </v-btn>
  <error-snack-bar :error="error" />
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSignInEmailPassword } from '@nhost/vue'

export default defineComponent({
  setup() {
    const email = ref('')
    const password = ref('')

    const router = useRouter()
    const { signInEmailPassword, error } = useSignInEmailPassword()
    const signIn = async () => {
      const { isSuccess } = await signInEmailPassword(email, password)
      if (isSuccess) {
        router.replace('/')
      }
    }

    return {
      email,
      error,
      password,
      signIn
    }
  }
})
</script>
