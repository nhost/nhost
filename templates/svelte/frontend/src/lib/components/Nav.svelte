<script lang="ts">
import NhostLogo from '$lib/components/NhostLogo.svelte';
import SignOutButton from '$lib/components/SignOutButton.svelte';
import { Button } from '$lib/components/ui/button';
import { useAuth } from '$lib/nhost/auth.svelte';

const auth = useAuth();

const user = $derived(auth.session?.user);
</script>

<nav
  class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
>
  <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
    <a
      href="/"
      class="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <NhostLogo class="size-5" />
      Nhost
    </a>

    {#if user}
      <div class="flex items-center gap-3">
        <span class="text-muted-foreground text-sm">
          {user.email ?? user.id}
        </span>
        <SignOutButton />
      </div>
    {:else}
      <Button href="/signin?intent=sign-in" variant="ghost" size="sm"
        >Sign in</Button
      >
    {/if}
  </div>
</nav>
