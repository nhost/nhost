<template>
  <form v-if="!otpSent" @submit="sendOTP">
    <v-text-field v-model="email" label="Email" />
    <v-btn block color="primary" type="submit" :disabled="isLoading" :loading="isLoading">
      Sign In
    </v-btn>
  </form>

  <form v-else @submit="signInWithOTP">
    <v-text-field v-model="otp" label="OTP" />

    <v-btn
      block
      color="primary"
      class="my-1"
      type="submit"
      :disabled="isLoading"
      :loading="isLoading"
    >
      Sign in
    </v-btn>
  </form>

  <v-btn class="my-1" block variant="text" color="primary" to="/signin">
    &#8592; Other Sign-in Options
  </v-btn>
  <error-snack-bar :error="error" />
  <otp-sent-dialog v-model="otpSentDialogOpen" :email="email" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import OtpSentDialog from '../../components/OtpSentDialog.vue'
import { useSignInEmailOTP } from '@nhost/vue'

const email = ref('')
const otp = ref('')
const otpSent = ref(false)
const otpSentDialogOpen = ref(false)

const router = useRouter()

const { signInEmailOTP, verifyEmailOTP, error, isLoading } = useSignInEmailOTP()

const sendOTP = async (e: Event) => {
  e.preventDefault()

  const { isSuccess } = await signInEmailOTP(email)

  if (isSuccess) {
    otpSent.value = true
    otpSentDialogOpen.value = true
  }
}

const signInWithOTP = async (e: Event) => {
  e.preventDefault()

  const { isSuccess } = await verifyEmailOTP(email, otp)

  if (isSuccess) {
    router.replace('/')
  }
}
</script>
