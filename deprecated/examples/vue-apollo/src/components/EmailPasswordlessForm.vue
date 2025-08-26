<template>
  <div>
    <form @submit="submit">
      <v-text-field v-model="email" placeholder="Email Address" autofocus />
      <v-btn block color="primary" type="submit" :disabled="isLoading" :loading="isLoading"> Continue with email
      </v-btn>
    </form>
    <error-snack-bar :error="error" />
    <v-dialog v-model="emailSentDialog">
      <v-card>
        <v-card-title>
          <span class="text-h5">Verification email sent</span>
        </v-card-title>
        <v-card-text>
          A email has been sent to {{ email }}. Please follow the link to sign in to the application.
        </v-card-text>
        <v-card-actions class="d-flex justify-center">
          <v-btn text @click="emailSentDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useSignInEmailPasswordless } from '@nhost/vue'

const email = ref('')
const emailSentDialog = ref(false)

const { signInEmailPasswordless, error, isLoading } = useSignInEmailPasswordless({
  redirectTo: '/profile'
})

const submit = async (e: Event) => {
  e.preventDefault()
  const { isSuccess } = await signInEmailPasswordless(email)
  if (isSuccess) {
    emailSentDialog.value = true
  }
}
</script>
