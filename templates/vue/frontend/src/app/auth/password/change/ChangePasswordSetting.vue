<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import { computed } from 'vue';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm.vue';
import DialogSetting from '@/components/DialogSetting.vue';

// The value is a mask, not a fact: the auth service never says whether an
// account has a password, and one made by magic link has none until it is set
// here.
const props = defineProps<{ user: User }>();

const staysSignedIn = computed(() => Boolean(props.user.email));
</script>

<template>
  <DialogSetting
    label="Password"
    value="••••••••"
    action="Change"
    title="Change password"
    :description="
      staysSignedIn
        ? 'Your other devices will be signed out. You\'ll stay signed in here.'
        : 'You\'ll be signed out everywhere, this device included.'
    "
  >
    <ChangePasswordForm :needs-code="user.activeMfaType === 'totp'" />
  </DialogSetting>
</template>
