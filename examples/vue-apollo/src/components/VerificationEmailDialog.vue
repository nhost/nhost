<template>
    <v-dialog v-model="modelValue">
        <v-card>
            <v-card-title>
                <span class="text-h5">Verification email sent</span>
            </v-card-title>
            <v-card-text>
                A email has been sent to {{ email }}. Please follow the link to verify your email address and to
                complete your registration.
            </v-card-text>
            <v-card-actions class="d-flex justify-center">
                <v-btn text @click="$emit('update:modelValue', false)">
                    Close
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts" setup>
defineProps(['modelValue', 'email'])
</script>
