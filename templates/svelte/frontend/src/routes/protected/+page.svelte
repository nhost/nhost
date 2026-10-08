<script lang="ts">
import { goto } from '$app/navigation';
import SignOutButton from '$lib/components/SignOutButton.svelte';
import * as Card from '$lib/components/ui/card';
import { useAuth } from '$lib/nhost/auth.svelte';
import { signInHref } from '$lib/signin/destination';

const auth = useAuth();

// This is a convenience, not a control. The check runs in the browser, so
// anyone can reach this component's markup by editing their own copy of the
// app. What protects data is the backend's permissions: the access token is
// what the API checks, and a request without a valid one gets nothing back
// no matter what this page renders.
const user = $derived(auth.session?.user);

// Nothing here guards against an unread session: `hooks.client.ts` awaits
// `startAuth` before this renders, so the stored session is already
// known and a signed-in visitor reloading is never bounced.
//
// An effect rather than a one-off check so that signing out in another tab
// moves this one too, and `replaceState` so the back button does not come
// straight back to a page that will bounce again.
$effect(() => {
  if (!user) {
    void goto(signInHref('/protected'), { replaceState: true });
  }
});
</script>

{#if user}
  <div class="mx-auto max-w-md">
    <Card.Root>
      <Card.Header>
        <Card.Title>Protected</Card.Title>
        <Card.Description>
          Only a signed-in visitor gets this far.
        </Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-4">
        <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-muted-foreground">Email</dt>
          <dd>{user.email ?? '—'}</dd>
          <dt class="text-muted-foreground">User id</dt>
          <dd class="font-mono text-xs">{user.id}</dd>
        </dl>
        <SignOutButton />
      </Card.Content>
    </Card.Root>
  </div>
{/if}
