<script lang="ts">
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';
import ResetPasswordForm from './ResetPasswordForm.svelte';

// The reset email's link goes through the auth service, which sends the
// browser back here with a refresh token that `lib/nhost/linkToken.ts`
// redeems on the way in, or with an error when the link expired or was
// already used. Both are handled in `startAuth`, which `hooks.client.ts`
// awaits before this renders. The error is checked first: a visitor who was
// already signed in still has a session when the link fails, and it is not
// the link's. Nor does a session prove the link signed them in, since a link
// never replaces one, so the form says whose password it changes rather than
// how they got here.
const auth = useAuth();

const session = $derived(auth.session);
</script>

<div class="mx-auto max-w-md">
  {#if auth.linkError || !session}
    <Card.Root>
      <Card.Header>
        <Card.Title>This link no longer works</Card.Title>
        <Card.Description>
          <!-- With an error, the notice above the page already says why. -->
          {#if !auth.linkError}
            It has expired or was already used.
          {/if}
          Request another one and open it from the same browser.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Button href="/auth/password">Request a new link</Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>Choose a new password</Card.Title>
        <Card.Description>
          You are signed in as
          {session.user?.email ?? session.user?.phoneNumber ?? 'this account'}.
          The new password is for that account.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <ResetPasswordForm />
      </Card.Content>
    </Card.Root>
  {/if}
</div>
