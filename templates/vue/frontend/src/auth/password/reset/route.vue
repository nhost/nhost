<script setup lang="ts">
import ResetPasswordForm from '@/auth/password/reset/ResetPasswordForm.vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/auth';

// The reset email's link goes through the auth service, which sends the
// browser back here with a refresh token that `lib/nhost/linkToken.ts`
// redeems on the way in. That happens in `startAuth`, which `main.ts` awaits
// before mounting, so by the time this renders a session means the link
// worked and no session means it was expired or already used.
const { session } = useAuth();
</script>

<template>
  <div v-if="!session" class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>This link no longer works</CardTitle>
        <CardDescription>
          It has expired or was already used. Request another one and open it
          from the same browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child>
          <RouterLink to="/auth/password">Request a new link</RouterLink>
        </Button>
      </CardContent>
    </Card>
  </div>

  <div v-else class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          The link signed you in as
          {{ session.user?.email ?? 'this account' }}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  </div>
</template>
