<script setup lang="ts">
import { defineComponent, ref } from 'vue'
import { useSignInEmailPassword } from '@nhost/vue'
import { useRouter } from 'vue-router'
const inputClass = 'px-4 py-2 bg-transparent border-1 border-gray-200 rounded outline-none w-250px outline-active:none dark:border-gray-700'
const { signInEmailPassword, needsEmailVerification } = useSignInEmailPassword()
const router = useRouter()
const email = ref('')
const password = ref('')
const handleSubmit = async () => {
  const { isSuccess } = await signInEmailPassword(email, password)
  if (isSuccess)
    router.push('/')
}
</script>

<template>
  <p v-if="needsEmailVerification">
    Your email is not yet verified. Please check your mailbox and follow the verification link
    finish registration.
  </p>

  <div
    v-else
  >
    <input
      v-model="email"
      type="email"
      placeholder="Email"
      :class="inputClass"
    ><br>
    <input
      v-model="password"
      type="password"
      placeholder="Password"
      :class="inputClass"
    ><br>

    <button class="m-3 text-sm btn" @click="handleSubmit">
      Sign in
    </button>
    <p>
      No account yet? <router-link to="/sign-up">
        Sign up
      </router-link>
    </p>
  </div>
</template>
