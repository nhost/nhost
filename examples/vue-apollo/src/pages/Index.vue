<template>
  <div>
    <h3>Index</h3>
    <q-input v-model="email" label="Email" />
    <q-input v-model="password" label="Password" type="password" />
    <q-btn @click="signIn" label="Sign in" />
    <q-btn @click="() => test()">TEST</q-btn>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { useSignInEmailPassword } from '@nhost/vue'
import { nhost } from '../main'
export default defineComponent({
  setup() {
    const email = ref('')
    const password = ref('')
    const { signInEmailPassword } = useSignInEmailPassword()
    const signIn = async () => {
      const result = signInEmailPassword(email.value, password.value)
      console.log(result)
    }
    const test = async () => {
      const res = await nhost.graphql.request(`query BooksQuery { books { id, title }}`)
      console.log(res)
    }
    return {
      email,
      password,
      signIn,
      test
    }
  }
})
</script>
