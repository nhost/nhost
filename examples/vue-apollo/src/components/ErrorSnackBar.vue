<template>
  <v-snackbar v-model="snack" :timeout="2_000" top>
    {{ error?.message }}
    <template #actions>
      <v-btn color="blue" variant="text" @click="snack = false"> Close </v-btn>
    </template>
  </v-snackbar>
</template>

<script lang="ts" setup>
import { PropType, ref, watchEffect } from 'vue'

import { ErrorPayload } from '@nhost/vue'

const props = defineProps({
  error: Object as PropType<ErrorPayload | null>
})
const snack = ref(false)

watchEffect(() => {
  if (props.error) {
    snack.value = true
  }
})


</script>
