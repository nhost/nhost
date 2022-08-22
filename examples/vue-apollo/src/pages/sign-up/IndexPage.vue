<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-title>Sign up</v-card-title>
      <v-card-text>
        <router-view />
      </v-card-text>
    </v-card>
    <v-divider class="my-4" style="min-width: 90%" />
    <div>Already have an account? <router-link to="/signin"> Sign in </router-link></div>
  </div>
</template>
