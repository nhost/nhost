<template>
  <Form />
  <v-btn class="my-1" block variant="text" color="primary" to="/signup"
    >&#8592; Other registration Options</v-btn
  >
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import Form from '../../components/EmailPasswordlessForm.vue'

export default defineComponent({
  components: {
    Form
  },
  setup() {
    const email = ref('')

    return { email }
  }
})
</script>
