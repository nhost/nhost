<script setup lang="ts">
import ProviderIcon from '@/app/auth/oauth/ProviderIcon.vue';
import LastUsedBadge from '@/components/LastUsedBadge.vue';
import { Button } from '@/components/ui/button';

export type OAuthLink = {
  id: string;
  label: string;
  href: string;
  lastUsed?: boolean;
};

/** One button per provider. */
defineProps<{ links: OAuthLink[] }>();
</script>

<template>
  <div class="flex flex-col gap-3">
    <Button
      v-for="link in links"
      :key="link.id"
      as-child
      variant="outline"
      class="relative w-full bg-transparent shadow-none dark:border-border dark:bg-transparent dark:hover:bg-accent"
    >
      <!-- The button sizes and spaces the mark itself: its own rules give any
           svg inside it size-4 and a gap from the text. -->
      <a :href="link.href">
        <ProviderIcon :id="link.id" />
        {{ link.label }}
        <LastUsedBadge v-if="link.lastUsed" />
      </a>
    </Button>
  </div>
</template>
