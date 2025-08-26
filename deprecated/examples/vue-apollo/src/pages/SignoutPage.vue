<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-text> Signed out </v-card-text>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
const router = useRouter()
setTimeout(() => router.replace('/'), 2_500)
</script>
