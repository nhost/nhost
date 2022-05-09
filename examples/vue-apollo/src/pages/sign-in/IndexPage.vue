<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-title>Log in to the Application</v-card-title>
      <v-card-text><router-view /></v-card-text>
    </v-card>
    <v-divider
      class="my-4"
      style="min-width: 90%"
    />
    <div>
      Don&lsquo;t have an account? <router-link to="/signup">
        Sign up
      </router-link>
    </div>
  </div>
</template>
