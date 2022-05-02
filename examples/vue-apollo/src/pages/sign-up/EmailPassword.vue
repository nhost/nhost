<template>
  <v-text-field v-model="email" label="Email" />
  <v-text-field v-model="password" label="Password" type="password" />
  <div v-if="error">{{ error.message }}</div>
  <v-btn block color="primary" class="my-1" @click="signUp"> Sign up </v-btn>
  <v-btn class="my-1" block variant="text" color="primary" to="/signup"
    >&#8592; Other registration Options</v-btn
  >
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useSignUpEmailPassword } from '@nhost/vue'

export default defineComponent({
  setup() {
    const email = ref('')
    const password = ref('')
    const { signUpEmailPassword, error } = useSignUpEmailPassword()
    const signUp = async () => {
      const result = await signUpEmailPassword(email.value, password.value)
      console.log(result)
    }

    return {
      email,
      error,
      password,
      signUp
    }
  }
})
</script>
