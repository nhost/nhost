<template>
  <v-btn
    class="my-1"
    block
    variant="contained-text"
    prepend-icon="mdi-github"
    color="white"
    style="background-color: #333"
    :href="github"
    >Continue with GitHub</v-btn
  >
  <v-btn
    class="my-1"
    block
    variant="contained-text"
    prepend-icon="mdi-google"
    color="white"
    style="background-color: #de5246"
    :href="google"
    >Continue with Google</v-btn
  >
  <v-btn
    class="my-1"
    block
    variant="contained-text"
    prepend-icon="mdi-facebook"
    color="white"
    style="background-color: #3b5998"
    :href="facebook"
    >Continue with Facebook</v-btn
  >
</template>

<script lang="ts">
import { useProviderLink } from '@nhost/vue'
import { defineComponent } from 'vue'

export default defineComponent({
  setup() {
    const { github, google, facebook } = useProviderLink()
    return { github, google, facebook }
  }
})
</script>
