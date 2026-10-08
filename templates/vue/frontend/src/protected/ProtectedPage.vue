<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import SignOutButton from '@/components/SignOutButton.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/auth';
import { signInHref } from '@/signin/destination';

const { session } = useAuth();
const router = useRouter();

// This is a convenience, not a control. The check runs in the browser, so
// anyone can reach this component's markup by editing their own copy of the
// app. What protects data is the backend's permissions: the access token is
// what the API checks, and a request without a valid one gets nothing back no
// matter what this page renders.
const user = computed(() => session.value?.user);

// Nothing here guards against an unread session: `main.ts` awaits `startAuth`
// before mounting, so the stored session is already known by the first render
// and a signed-in visitor reloading this page is never bounced.
//
// `watchEffect` rather than a one-off check so that signing out in another tab
// moves this one too, and `replace` so the back button does not come straight
// back to a page that will bounce again.
watchEffect(() => {
  if (!user.value) {
    void router.replace(signInHref('/protected'));
  }
});
</script>

<template>
  <div v-if="user" class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Protected</CardTitle>
        <CardDescription>
          Only a signed-in visitor gets this far.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-muted-foreground">Email</dt>
          <dd>{{ user.email ?? '—' }}</dd>
          <dt class="text-muted-foreground">User id</dt>
          <dd class="font-mono text-xs">{{ user.id }}</dd>
        </dl>
        <SignOutButton />
      </CardContent>
    </Card>
  </div>
</template>
