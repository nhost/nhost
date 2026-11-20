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
import OtpForm from './OtpForm.vue';

const route = useRoute();
// Opens the form on the code step for this address (see `link.ts`). It is only
// ever shown, and "Use a different address" replaces it, so a crafted one does
// nothing.
const sentTo = computed(
  () => firstQueryValue(route.query.email)?.trim() || undefined,
);
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
        <CardTitle>Email code</CardTitle>
        <CardDescription>
          We email you a one-time code and you type it in here.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <OtpForm :next="destination" :sent-to="sentTo" />
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
