<script setup lang="ts">
import { computed } from 'vue';
import PasswordForm from '@/auth/password/PasswordForm.vue';
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

const next = useNext();
const intent = useIntent();
const query = computed(() => signInQuery(next.value, intent.value));
const mailboxUrl = localMailboxURL();
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Email and password</CardTitle>
        <CardDescription>
          Sign in, or sign up and confirm your address by email.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <PasswordForm
          :next="next"
          :intent="intent"
          :mailbox-url="mailboxUrl"
        />
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
