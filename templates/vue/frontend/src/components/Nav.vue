<script setup lang="ts">
import { computed } from 'vue';
import NhostLogo from '@/components/NhostLogo.vue';
import SignOutButton from '@/components/SignOutButton.vue';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/nhost/auth';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInQuery } from '@/signin/query';

const { session } = useAuth();

const user = computed(() => session.value?.user);

const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
</script>

<template>
  <nav
    class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
  >
    <div
      class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3"
    >
      <RouterLink
        to="/"
        class="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NhostLogo class="size-5" />
        Nhost
      </RouterLink>

      <div v-if="user" class="flex items-center gap-3">
        <span class="text-muted-foreground text-sm">
          {{ user.email ?? user.id }}
        </span>
        <SignOutButton />
      </div>
      <Button v-else as-child variant="ghost" size="sm">
        <RouterLink :to="signInLink">Sign in</RouterLink>
      </Button>
    </div>
  </nav>
</template>
