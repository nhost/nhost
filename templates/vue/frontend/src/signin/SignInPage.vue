<script setup lang="ts">
import { computed } from 'vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { methods } from '@/signin/methods';
import { useNext } from '@/signin/useNext';

/**
 * Lists the ways to sign in. Each method is a page of its own under
 * `/auth/<method>`; this page only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the visitor was going when a protected page sent them here.
 * It is passed along to whichever method they pick, so that page can finish
 * the trip after signing them in.
 */
const next = useNext();

const query = computed(() =>
  next.value === DEFAULT_DESTINATION
    ? ''
    : `?next=${encodeURIComponent(next.value)}`,
);
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Choose how you want to sign in.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2">
        <RouterLink
          v-for="method in methods"
          :key="method.href"
          :to="`${method.href}${query}`"
          class="rounded-md border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div class="font-medium">{{ method.title }}</div>
          <div class="text-muted-foreground text-sm">
            {{ method.description }}
          </div>
        </RouterLink>
      </CardContent>
    </Card>
  </div>
</template>
