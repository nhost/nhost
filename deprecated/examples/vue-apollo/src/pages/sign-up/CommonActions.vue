<template>
  <oauth-links />
  <v-divider class="my-4" />
  <v-btn
    class="my-1"
    block
    variant="outlined"
    prepend-icon="mdi-lock"
    color="primary"
    to="/signup/passwordless"
  >
    Continue with passwordless email
  </v-btn>
  <v-btn class="my-1" block variant="text" color="primary" to="/signup/email-password">
    Continue with email + password
  </v-btn>
  <v-btn class="my-1" block variant="text" color="primary" to="/signup/security-key">
    Continue with security key
  </v-btn>
</template>
