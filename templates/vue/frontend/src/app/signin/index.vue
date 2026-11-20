<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { signInDestination } from '@/app/signin/destination';
import { type Intent, signInIntent } from '@/app/signin/intent';
import { lastUsedSignIn } from '@/app/signin/lastUsed';
import { buttons, methods } from '@/app/signin/methods';
import { signInQuery } from '@/app/signin/query';
import LastUsedBadge from '@/components/LastUsedBadge.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { firstQueryValue } from '@/lib/routeQuery';

/** Lists the ways to sign in. */

// What the page says depends on why the visitor is here.
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

const route = useRoute();
const destination = computed(() =>
  signInDestination(firstQueryValue(route.query.next)),
);
const chosen = computed(() =>
  signInIntent(firstQueryValue(route.query.intent)),
);
const query = computed(() => signInQuery(destination.value, chosen.value));
const switchTo = computed(() => copy[chosen.value].switchTo);
const lastUsed = lastUsedSignIn();
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card>
      <!-- Everything is centred, the links included, to match the provider
           buttons, which centre their own label. -->
      <CardHeader class="text-center">
        <CardTitle>{{ copy[chosen].title }}</CardTitle>
        <CardDescription>{{ copy[chosen].description }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 px-10">
        <RouterLink
          v-for="method in methods"
          :key="method.href"
          :to="`${method.href}${query}`"
          class="relative rounded-md border px-4 py-2 text-center outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LastUsedBadge v-if="method.href === lastUsed" />
          <div class="font-medium text-sm">{{ method.title }}</div>
          <div class="text-muted-foreground text-xs">
            {{ method.description }}
          </div>
        </RouterLink>
        <template v-if="buttons.length > 0">
          <!-- Set apart from the links: these leave for the provider straight
               away, where a link opens a page of the app's. -->
          <div
            v-if="methods.length > 0"
            class="flex items-center gap-3 py-2 text-muted-foreground text-xs"
          >
            <span class="h-px flex-1 bg-border" />
            or
            <span class="h-px flex-1 bg-border" />
          </div>
          <component
            :is="Buttons"
            v-for="(Buttons, index) in buttons"
            :key="index"
            :destination="destination"
            :last-used="lastUsed"
          />
        </template>
        <!-- A clear gap, not a nudge: this is the way out of the list, not
             another item in it. -->
        <p class="pt-6 text-center text-muted-foreground text-sm">
          {{ switchTo.prompt }}
          <RouterLink
            :to="`/signin${signInQuery(destination, switchTo.intent)}`"
            class="text-foreground underline-offset-4 hover:underline"
            >{{
              switchTo.label
            }}</RouterLink
          >
        </p>
      </CardContent>
    </Card>
  </div>
</template>
