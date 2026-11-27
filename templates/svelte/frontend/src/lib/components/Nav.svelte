<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import NavAccount from '#lib/components/NavAccount.svelte';
  import NhostLogo from '#lib/components/NhostLogo.svelte';
  import RefreshOnFocus from '#lib/components/RefreshOnFocus.svelte';
  import SignOutButton from '#lib/components/SignOutButton.svelte';
  import UserAvatar from '#lib/components/UserAvatar.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
  import { methods } from '#routes/signin/methods.ts';
  import { signInQuery } from '#routes/signin/query.ts';

  // The session's user, as the root layout loads it.
  let { user }: { user: User | null } = $props();

  const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
  const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;

  const signedOutPaths = methods.flatMap(
    (method) => method.signedOutPaths ?? [],
  );
</script>

{#snippet signedIn()}
  {#if user}
    <div class="flex items-center gap-3">
      <SignOutButton />
      <a
        href="/account"
        class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserAvatar
          avatarUrl={user.avatarUrl}
          displayName={user.displayName}
          width={64}
          class="size-8 text-xs"
        />
        <span class="sr-only">Your account</span>
      </a>
    </div>
  {/if}
{/snippet}

{#snippet signedOut()}
  <div class="flex items-center gap-3">
    <Button href={signInLink} variant="outline" size="sm">Sign in</Button>
    <Button href={signUpLink} size="sm">Sign up</Button>
  </div>
{/snippet}

<nav
  class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
>
  <RefreshOnFocus signedIn={!!user} />
  <div
    class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3"
  >
    <a
      href="/"
      class="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <NhostLogo class="size-5" />
      Nhost
    </a>

    <NavAccount
      {signedOutPaths}
      signedIn={user ? signedIn : null}
      {signedOut}
    />
  </div>
</nav>
