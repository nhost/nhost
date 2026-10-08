<script setup lang="ts">
import { computed } from 'vue';
import MagicLinkForm from '@/auth/magic-link/MagicLinkForm.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';
import OtherWaysLink from '@/signin/OtherWaysLink.vue';
import { signInQuery } from '@/signin/query';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

/**
 * Magic link sign-in. The page only sends the email: the link in it goes to
 * the auth service, which signs the visitor in and redirects back to `next`
 * with a refresh token `lib/nhost/linkToken.ts` redeems on arrival.
 */
const next = useNext();
const intent = useIntent();
const query = computed(() => signInQuery(next.value, intent.value));
const mailboxUrl = localMailboxURL();
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Magic link</CardTitle>
        <CardDescription>
          Enter your email and we will send you a link that signs you in.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <MagicLinkForm :next="next" :mailbox-url="mailboxUrl" />
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
