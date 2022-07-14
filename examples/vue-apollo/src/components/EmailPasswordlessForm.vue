<template>
  <div>
    <v-text-field v-model="email" placeholder="Email Address" autofocus />
    <v-btn block color="primary" @click="signIn"> Continue with email </v-btn>
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
          <v-btn text @click="$emit('update:modelValue', false)">
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

const { signInEmailPasswordless, error } = useSignInEmailPasswordless({
  redirectTo: '/#/profile'
})

const signIn = async () => {
  const { isSuccess } = await signInEmailPasswordless(email)
  if (isSuccess) {
    emailSentDialog.value = true
  }
}
</script>
