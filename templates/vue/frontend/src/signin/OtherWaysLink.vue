<script setup lang="ts">
import { methods } from '@/signin/methods';

/**
 * Sends the visitor back to the list of sign-in methods, when there is a list
 * worth going back to.
 *
 * `--auth-methods` can scaffold a single method, and `methods.ts` is the only
 * thing that knows how many there are. With one, the sign-in page offers
 * nothing this page does not already show, so the link would promise choices
 * that do not exist.
 *
 * It reads `methods.ts` rather than naming any method, which is what keeps it
 * shared: deleting a method changes the count and nothing here.
 */
defineProps<{ query: string }>();
</script>

<template>
  <RouterLink
    v-if="methods.length > 1"
    :to="`/signin${query}`"
    class="text-muted-foreground text-sm underline-offset-4 hover:underline"
  >
    Other ways to sign in
  </RouterLink>
</template>
