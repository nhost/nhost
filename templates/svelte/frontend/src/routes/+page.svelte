<script lang="ts">
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';

const auth = useAuth();

const user = $derived(auth.session?.user);
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
        <Button href="/signin">Sign up</Button>
        <Button href="/signin?intent=sign-in" variant="outline">Sign in</Button>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
