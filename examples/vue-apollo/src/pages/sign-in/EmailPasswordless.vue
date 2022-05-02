<template>
  <Form />
  <v-btn class="my-1" block variant="text" color="primary" to="/signin"
    >&#8592; Other Login Options</v-btn
  >
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Form from '../../components/EmailPasswordlessForm.vue'

export default defineComponent({
  components: {
    Form
  }
})
</script>
