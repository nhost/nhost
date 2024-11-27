<template>
  <v-dialog :modelValue="modelValue" @update:modelValue="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>
        <span class="text-h5">Verification email sent</span>
      </v-card-title>
      <v-card-text>
        An email has been sent to {{ email }}. Please follow the link to verify your email address
        and to complete your registration.
      </v-card-text>
      <v-card-actions class="justify-center d-flex">
        <v-btn text @click="$emit('update:modelValue', false)"> Close </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { defineProps } from 'vue'

const props = defineProps(['modelValue', 'email'])
</script>
