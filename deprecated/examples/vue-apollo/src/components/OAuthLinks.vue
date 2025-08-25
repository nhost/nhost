<template>
  <v-btn
    class="my-1"
    block
    variant="text"
    prepend-icon="mdi-github"
    color="white"
    style="background-color: #333"
    :href="github"
  >
    Continue with GitHub
  </v-btn>
</template>

<script lang="ts" setup>
import { useProviderLink } from '@nhost/vue'

const { github } = useProviderLink({ redirectTo: `${window.location.origin}/profile` })
</script>
