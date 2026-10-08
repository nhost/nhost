<script setup lang="ts">
import { Button } from '@/components/ui/button';

export type OAuthLink = {
  id: string;
  label: string;
  href: string;
};

/**
 * One button per provider. Plain anchors rather than a `RouterLink`: the href
 * is the auth service, another origin, and the whole point is to leave this
 * app for it.
 */
defineProps<{ links: OAuthLink[] }>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <Button
      v-for="link in links"
      :key="link.id"
      as-child
      variant="outline"
      class="w-full"
    >
      <a :href="link.href">{{ link.label }}</a>
    </Button>
  </div>
</template>
