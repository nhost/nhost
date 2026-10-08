<script lang="ts">
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';
import ResetPasswordForm from './ResetPasswordForm.svelte';

// The reset email's link goes through the auth service, which sends the
// browser back here with a refresh token that `lib/nhost/linkToken.ts`
// redeems on the way in. That happens in `startAuth`, which
// `hooks.client.ts` awaits, so by the time this renders a session means the link
// worked and no session means it was expired or already used.
const auth = useAuth();

const session = $derived(auth.session);
</script>

<div class="mx-auto max-w-md">
  {#if !session}
    <Card.Root>
      <Card.Header>
        <Card.Title>This link no longer works</Card.Title>
        <Card.Description>
          It has expired or was already used. Request another one and open it
          from the same browser.
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
          The link signed you in as {session.user?.email ?? 'this account'}.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <ResetPasswordForm />
      </Card.Content>
    </Card.Root>
  {/if}
</div>
