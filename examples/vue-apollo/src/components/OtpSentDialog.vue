<template>
  <v-dialog :modelValue="modelValue" @update:modelValue="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>
        <span class="text-h5">OTP sent via email</span>
      </v-card-title>
      <v-card-text>
        An email has been sent to {{ email }}. Please check your inbox for the OTP.
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
