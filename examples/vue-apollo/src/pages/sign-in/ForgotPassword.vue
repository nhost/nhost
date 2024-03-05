<template>
  <form @submit="handleSendResetPasswordEmail">
    <v-text-field v-model="email" label="Email" />
    <v-btn block color="primary" class="my-1" type="submit"> Reset password </v-btn>

    <v-dialog v-model="emailSent">
      <v-card>
        <v-card-title>
          <span class="text-h5">Verification email sent</span>
        </v-card-title>
        <v-card-text>
          A email has been sent to {{ email }}. Please follow the link to reset the password.
        </v-card-text>
        <v-card-actions class="justify-center d-flex">
          <v-btn text @click="emailSent = false"> Close </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </form>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useResetPassword } from '@nhost/vue'

const email = ref('')
const emailSent = ref(false)

const { resetPassword } = useResetPassword({
  redirectTo: '/profile'
})

const handleSendResetPasswordEmail = async (e: Event) => {
  e.preventDefault()
  await resetPassword(email)
  emailSent.value = true
}
</script>
