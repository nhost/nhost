<template>
  <div>
    <v-text-field placeholder="Email Address" v-model="email" autoFocus />
    <div v-if="error">{{ error.message }}</div>
    <v-btn block color="primary" @click="signIn"> Continue with email </v-btn>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useSignInEmailPasswordless } from '@nhost/vue'
export default defineComponent({
  setup() {
    const email = ref('')
    const { signInEmailPasswordless, error } = useSignInEmailPasswordless({
      // TODO hash history
      // redirectTo: '/profile'
    })
    const signIn = async () => {
      const { isSuccess } = await signInEmailPasswordless(email)
      // TODO overlay
    }
    return { email, signIn, error }
  }
})
</script>
