<script lang="ts">
  import NavAccount from '#lib/components/NavAccount.svelte';
  import NhostLogo from '#lib/components/NhostLogo.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
  import { methods } from '#routes/signin/methods.ts';
  import { signInQuery } from '#routes/signin/query.ts';

  const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
  const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;

  const signedOutPaths = methods.flatMap(
    (method) => method.signedOutPaths ?? [],
  );
</script>

<nav
  class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
>
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

    <NavAccount {signedOutPaths} signedIn={null} {signedOut} />
  </div>
</nav>

{#snippet signedOut()}
  <div class="flex items-center gap-3">
    <Button href={signInLink} variant="outline" size="sm">Sign in</Button>
    <Button href={signUpLink} size="sm">Sign up</Button>
  </div>
{/snippet}
