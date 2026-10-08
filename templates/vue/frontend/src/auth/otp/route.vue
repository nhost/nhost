<script setup lang="ts">
import { computed } from 'vue';
import OtpForm from '@/auth/otp/OtpForm.vue';
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
        <CardTitle>Email code</CardTitle>
        <CardDescription>
          We email you a one-time code and you type it in here.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <OtpForm :next="next" :mailbox-url="mailboxUrl" />
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
