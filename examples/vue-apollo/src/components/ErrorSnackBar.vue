<template>
  <v-snackbar v-model="snack" :timeout="2_000">
    {{ error?.message }}
    <template v-slot:actions>
      <v-btn color="blue" variant="text" @click="snack = false"> Close </v-btn>
    </template>
  </v-snackbar>
</template>

<script lang="ts">
import { ErrorPayload } from '@nhost/core'
import { defineComponent, PropType, ref, watchEffect } from 'vue'
export default defineComponent({
  props: {
    error: Object as PropType<ErrorPayload | null>
  },
  setup(props) {
    const snack = ref(false)
    
    watchEffect(() => {
      if (props.error) {
        snack.value = true
      }
    })

    return { snack }
  }
})
</script>
