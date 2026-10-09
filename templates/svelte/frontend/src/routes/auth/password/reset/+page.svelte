<script lang="ts">
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';
import PasswordChanged from './PasswordChanged.svelte';
import ResetPasswordForm from './ResetPasswordForm.svelte';
import { passwordSignIn, resetView } from './resetView';

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

let pending = $state(false);
let changed = $state(false);

const view = $derived(
  resetView({
    changed,
    pending,
    signedIn: session !== null,
    linkFailed: auth.linkError !== null,
  }),
);
</script>

<div class="mx-auto max-w-md">
  {#if view === 'changed'}
    <PasswordChanged />
  {:else if view === 'link-failed'}
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
        <Button href={passwordSignIn}>Request a new link</Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Hidden rather than removed while waiting, so the form is still there
    to report the change when its call returns. -->
    <div hidden={view === 'waiting'}>
      <Card.Root>
        <Card.Header>
          <Card.Title>Choose a new password</Card.Title>
          <Card.Description>
            You are signed in as
            {session?.user?.email ?? session?.user?.phoneNumber ?? 'this account'}.
            The new password is for that account.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ResetPasswordForm bind:pending onchanged={() => (changed = true)} />
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>
