<script setup lang="ts">
import { ref } from 'vue'
import { useSignUpEmailPassword } from '@nhost/vue'
import { useRouter } from 'vue-router'

const { signUpEmailPassword, needsEmailVerification } = useSignUpEmailPassword()
const router = useRouter()
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const handleSubmit = async (event: Event) => {
  event.preventDefault()
  const { isSuccess } = await signUpEmailPassword(email, password, {
    metadata: { firstName, lastName },
  })
  if (isSuccess)
    router.push('/')
}
</script>

<template>
  <p v-if="needsEmailVerification">
    Please check your mailbox and follow the verification link to verify your email.
  </p>

  <form v-else @submit="handleSubmit">
    <input v-model="firstName" placeholder="First name" class="input">
    <br />
    <input v-model="lastName" placeholder="Last name" class="input">
    <br />
    <input v-model="email" type="email" placeholder="Email" class="input">
    <br />
    <input v-model="password" type="password" placeholder="Password" class="input">
    <br />

    <button class="btn-submit" type="submit">
      Sign up
    </button>
  </form>
</template>
