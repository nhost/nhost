<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400" v-if="!loading">
      <v-card-text>Failed to authenticate with magick link</v-card-text>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNhostClient } from '@nhost/vue'

const { nhost } = useNhostClient()
const route = useRoute()

const loading = ref(true)

onMounted(() => {
  const ticket = route.query.ticket
  const redirectTo = route.query.redirectTo
  const type = route.query.type

  if (ticket && redirectTo && type) {
    window.location.href = `${nhost.auth.url}/verify?ticket=${ticket}&type=${type}&redirectTo=${redirectTo}`
  }

  loading.value = false
})
</script>
