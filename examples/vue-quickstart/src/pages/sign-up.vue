<script setup lang="ts">
import { ref } from 'vue'
import { useSignUpEmailPassword } from '@nhost/vue'
import { useRouter } from 'vue-router'
const inputClass
  = 'px-4 py-2 bg-transparent border-1 border-gray-200 rounded outline-none w-250px outline-active:none dark:border-gray-700'

const { signUpEmailPassword, needsEmailVerification } = useSignUpEmailPassword()
const router = useRouter()
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const handleSubmit = async () => {
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

  <div v-else>
    <input v-model="firstName" placeholder="First name" :class="inputClass"><br>
    <input v-model="lastName" placeholder="Last name" :class="inputClass"><br>
    <input v-model="email" type="email" placeholder="Email" :class="inputClass"><br>
    <input v-model="password" type="password" placeholder="Password" :class="inputClass"><br>

    <button class="m-3 text-sm btn" @click="handleSubmit">
      Sign up
    </button>
  </div>
</template>
