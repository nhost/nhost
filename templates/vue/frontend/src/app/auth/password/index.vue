<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import PasswordForm from '@/app/auth/password/PasswordForm.vue';
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

const route = useRoute();
const destination = computed(() =>
  signInDestination(firstQueryValue(route.query.next)),
);
const chosen = computed(() =>
  signInIntent(firstQueryValue(route.query.intent)),
);
const query = computed(() => signInQuery(destination.value, chosen.value));
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card>
      <CardHeader>
        <CardTitle>Email and password</CardTitle>
        <CardDescription>
          Sign in, or sign up and confirm your address by email.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <PasswordForm :next="destination" :intent="chosen" />
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
