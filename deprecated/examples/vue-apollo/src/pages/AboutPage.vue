<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-title>About this example</v-card-title>
      <v-card-text>This application demonstrates the available features of the Nhost stack.
        <p class="pt-2">Nhost cloud leverages the
          following services in the backend:
        <ul class="px-8">
          <li>Hasura</li>
          <li>Hasura Auth</li>
          <li>Hasura Storage</li>
          <li>Lambda Functions</li>
        </ul>
        </p>
        <p class="py-2">
          This frontend is built with the following technologies:
        <ul class="px-8">
          <li>Vue 3</li>
          <li>Vue-router</li>
          <li>Vuetify 3</li>
          <li>and of course, the Nhost Vue client</li>
        </ul>

        </p>
        Now let's go to the <router-link to="/">Home page</router-link>.
      </v-card-text>
    </v-card>
  </div>
</template>
