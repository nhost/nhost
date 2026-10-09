<script setup lang="ts">
import { computed } from 'vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Intent } from '@/signin/intent';
import { methods } from '@/signin/methods';
import { signInQuery } from '@/signin/query';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

/**
 * Lists the ways to sign in. Each method is a page of its own under
 * `/auth/<method>`; this page only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the visitor was going when a protected page sent them here,
 * and `intent` is whether they came to sign up or to sign in. Both are passed
 * along to whichever method they pick: one so that page can finish the trip,
 * the other so a form opens on the right mode.
 */

// What the page says depends on why the visitor is here. Neither heading names
// a method, so both survive any selection. Each also offers the other intent,
// since a protected page sends a visitor here without one and the page then
// opens on sign up, whether or not they have an account.
const copy: Record<
  Intent,
  {
    title: string;
    description: string;
    switchTo: { intent: Intent; prompt: string; label: string };
  }
> = {
  'sign-up': {
    title: 'Create an account',
    description: 'Choose how you want to sign up.',
    switchTo: {
      intent: 'sign-in',
      prompt: 'Already have an account?',
      label: 'Sign in',
    },
  },
  'sign-in': {
    title: 'Sign in',
    description: 'Choose how you want to sign in.',
    switchTo: {
      intent: 'sign-up',
      prompt: 'New here?',
      label: 'Create an account',
    },
  },
};

const next = useNext();
const intent = useIntent();

const query = computed(() => signInQuery(next.value, intent.value));
const switchTo = computed(() => copy[intent.value].switchTo);
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>{{ copy[intent].title }}</CardTitle>
        <CardDescription>{{ copy[intent].description }}</CardDescription>
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
        <p class="pt-2 text-muted-foreground text-sm">
          {{ switchTo.prompt }}
          <RouterLink
            :to="`/signin${signInQuery(next, switchTo.intent)}`"
            class="text-foreground underline-offset-4 hover:underline"
          >
            {{ switchTo.label }}
          </RouterLink>
        </p>
      </CardContent>
    </Card>
  </div>
</template>
