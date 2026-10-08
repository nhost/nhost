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
        {user ? 'You are signed in' : 'You are signed out'}
      </Card.Title>
      <Card.Description>
        {user
          ? `Signed in as ${user.email ?? user.id}.`
          : 'Pick a sign-in method to get a session.'}
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex gap-2">
      <Button href={user ? '/protected' : '/signin'}>
        {user ? 'Open the protected page' : 'Sign in'}
      </Button>
    </Card.Content>
  </Card.Root>
</div>
