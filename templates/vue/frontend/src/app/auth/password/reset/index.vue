<script setup lang="ts">
import { passwordSignIn } from '@/app/auth/password/passwordSignIn';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm.vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSession } from '@/lib/nhost/auth';

// The reset email's link goes through the auth service, which sends the user
// back here with a refresh token startup redeems only for a signed-out
// visitor.
const session = useSession();
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card v-if="!session">
      <CardHeader>
        <CardTitle>This link no longer works</CardTitle>
        <CardDescription>
          It has expired or was already used. Request another one and open it
          from the same browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child>
          <RouterLink :to="passwordSignIn">Request a new link</RouterLink>
        </Button>
      </CardContent>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          You are signed in as {{ session.user?.email ?? 'this account' }}.
          Choose a new password for this account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  </div>
</template>
