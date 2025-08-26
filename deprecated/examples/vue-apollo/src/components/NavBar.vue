<template>
  <v-list nav>
    <v-list-item title="Home" to="/" value="home" prepend-icon="mdi-home" />
    <v-list-item title="Profile" to="/profile" value="profile" prepend-icon="mdi-account" />
    <v-list-item
      title="Secret Notes"
      to="/secret-notes"
      value="secret-notes"
      prepend-icon="mdi-lock"
    />
    <v-list-item title="Apollo" to="/apollo" value="apollo" prepend-icon="mdi-api" />
    <v-list-item title="Storage" to="/storage" value="storage" prepend-icon="mdi-server" />
    <v-list-item title="About" to="/about" value="about" prepend-icon="mdi-information" />
    <v-list-item
      v-if="authenticated"
      title="Sign out"
      prepend-icon="mdi-exit-to-app"
      @click="signOutHandler"
    />

    <v-card-text class="d-flex flex-column align-center justify-space-between align-self-end">
      <span>Elevated permissions: {{ elevated }}</span>
      <v-btn variant="text" color="primary" @click="handleElevate(user?.email)"> Elevate </v-btn>
    </v-card-text>
  </v-list>

  <v-snackbar :modelValue="showElevateSuccess">
    You now have an elevated permission
    <template v-slot:actions>
      <v-btn color="indigo" variant="text" @click="showElevateError = false"> Close </v-btn>
    </template>
  </v-snackbar>
  <v-snackbar :modelValue="showElevateError">
    Could not elevate permission
    <template v-slot:actions>
      <v-btn color="indigo" variant="text" @click="showElevateError = false"> Close </v-btn>
    </template>
  </v-snackbar>
  <v-snackbar :modelValue="loggedOutWarning">
    You are logged out. Please login first!
    <template v-slot:actions>
      <v-btn color="indigo" variant="text" @click="loggedOutWarning = false"> Close </v-btn>
    </template>
  </v-snackbar>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { useAuthenticated, useSignOut, useElevateSecurityKeyEmail, useUserData } from '@nhost/vue'

const user = useUserData()
const router = useRouter()
const { signOut } = useSignOut()
const showElevateError = ref(false)
const showElevateSuccess = ref(false)
const loggedOutWarning = ref(false)
const authenticated = useAuthenticated()
const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()

const signOutHandler = async () => {
  await signOut()
  router.push('/')
}

const handleElevate = async (email: string | undefined) => {
  if (!authenticated.value) {
    loggedOutWarning.value = true
    return
  }

  if (email) {
    const { elevated, isError } = await elevateEmailSecurityKey(email)

    if (elevated) {
      showElevateSuccess.value = true
    }

    if (isError) {
      showElevateError.value = true
    }
  }
}
</script>
