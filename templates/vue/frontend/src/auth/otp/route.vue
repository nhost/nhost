<script setup lang="ts">
import OtpForm from '@/auth/otp/OtpForm.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';
import { useNext } from '@/signin/useNext';

const next = useNext();
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
        <RouterLink
          to="/signin"
          class="text-muted-foreground text-sm underline underline-offset-4"
        >
          Other ways to sign in
        </RouterLink>
      </CardContent>
    </Card>
  </div>
</template>
