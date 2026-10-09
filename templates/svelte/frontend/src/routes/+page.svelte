<script lang="ts">
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';
import { DEFAULT_DESTINATION } from '$lib/signin/destination';
import { signInQuery } from '$lib/signin/query';

const auth = useAuth();

const user = $derived(auth.session?.user);

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
</script>

<div class="mx-auto max-w-md">
  <Card.Root>
    <Card.Header>
      <Card.Title>
        {user ? 'You are signed in' : 'You are not signed in'}
      </Card.Title>
      <Card.Description>
        {user
          ? `Signed in as ${user.email ?? user.id}.`
          : 'Create an account, or sign in to one you already have.'}
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex gap-2">
      {#if user}
        <Button href="/protected">Open the protected page</Button>
      {:else}
        <!-- Sign up first: a fresh local backend has no accounts in it. -->
        <Button href={signUpLink}>Sign up</Button>
        <Button href={signInLink} variant="outline">Sign in</Button>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
