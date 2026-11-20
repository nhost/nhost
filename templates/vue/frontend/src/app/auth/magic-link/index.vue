<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { signInDestination } from '@/app/signin/destination';
import { signInIntent } from '@/app/signin/intent';
import OtherWaysLink from '@/app/signin/OtherWaysLink.vue';
import { signInQuery } from '@/app/signin/query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { firstQueryValue } from '@/lib/routeQuery';
import MagicLinkForm from './MagicLinkForm.vue';

/** Magic link sign-in. */
const route = useRoute();
const destination = computed(() =>
  signInDestination(firstQueryValue(route.query.next)),
);
const query = computed(() =>
  signInQuery(
    destination.value,
    signInIntent(firstQueryValue(route.query.intent)),
  ),
);
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card>
      <CardHeader>
        <CardTitle>Magic link</CardTitle>
        <CardDescription>
          Enter your email and we will send you a link that signs you in.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <MagicLinkForm :next="destination" />
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
