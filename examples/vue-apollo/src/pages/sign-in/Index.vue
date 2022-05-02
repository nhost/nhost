<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-title>Log in to the Application</v-card-title>
      <v-card-text><router-view/></v-card-text>
    </v-card>
    <v-divider class="my-4" style="min-width: 90%" />
    <div>Don&lsquo;t have an account? <router-link to="/signup">Sign up</router-link></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Links from '../../components/OAuthLinks.vue'
export default defineComponent({
  components: {
    Links
  }
})
</script>
