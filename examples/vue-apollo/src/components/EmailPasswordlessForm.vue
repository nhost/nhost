<template>
  <div>
    <v-text-field placeholder="Email Address" v-model="email" autoFocus />
    <v-btn block color="primary" @click="signIn"> Continue with email </v-btn>
    <error-snack-bar :error="error" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useSignInEmailPasswordless } from '@nhost/vue'

export default defineComponent({
  setup() {
    const email = ref('')
    const { signInEmailPasswordless, error } = useSignInEmailPasswordless({
      redirectTo: '/#/profile'
    })

    const signIn = () => signInEmailPasswordless(email)
    return { email, signIn, error }
  }
})
</script>
