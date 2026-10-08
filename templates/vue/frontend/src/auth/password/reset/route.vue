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
// redeems on the way in, or with an error when the link expired or was
// already used. Both are handled in `startAuth`, before this renders. The
// error is checked first: a visitor who was already signed in still has a
// session when the link fails, and it is not the link's. Nor does a session
// prove the link signed them in, since a link never replaces one, so the
// form says whose password it changes rather than how they got here.
const { session, linkError } = useAuth();
</script>

<template>
  <div v-if="linkError || !session" class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>This link no longer works</CardTitle>
        <CardDescription>
          <!-- With an error, the notice above the page already says why. -->
          {{
            linkError
              ? 'Request another one and open it from the same browser.'
              : 'It has expired or was already used. Request another one and open it from the same browser.'
          }}
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
          You are signed in as
          {{
            session.user?.email ?? session.user?.phoneNumber ?? 'this account'
          }}. The new password is for that account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  </div>
</template>
