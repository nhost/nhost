<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import { Card } from '@/components/ui/card';

defineProps<{ user: User }>();
</script>

<template>
  <Card class="flex-row items-center gap-5 p-5">
    <UserAvatar
      :avatar-url="user.avatarUrl"
      :display-name="user.displayName"
      :width="192"
      class="size-18 text-2xl"
    />
    <p class="min-w-0 flex-1 truncate font-medium">
      {{ user.email ?? user.id }}
    </p>
  </Card>
</template>
