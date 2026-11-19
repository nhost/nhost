<!-- @component The starter's front page: what this is and what to try first. -->
<script lang="ts">
  import CenteredLayout from '#lib/components/CenteredLayout.svelte';
  import Code from '#lib/components/Code.svelte';
  import SignOutLink from '#lib/components/SignOutLink.svelte';
  import StackTitle from '#lib/components/StackTitle.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
  import { signInQuery } from '#routes/signin/query.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const user = $derived(data.user);

  const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
  const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
</script>

{#snippet step(n: number, title: string, body: import('svelte').Snippet)}
  <li class="flex gap-4">
    <span
      class="flex size-7 shrink-0 items-center justify-center rounded-full border font-medium text-sm"
    >
      {n}
    </span>
    <div class="flex flex-col gap-2 pt-0.5">
      <h2 class="font-medium">{title}</h2>
      <div class="flex flex-col gap-3 text-muted-foreground text-sm">
        {@render body()}
      </div>
    </div>
  </li>
{/snippet}

{#snippet createAccount()}
  {#if user}
    <p>Done: you are signed in as {user.email ?? user.id}.</p>
  {:else}
    <p>Sign up with any of the ways the sign-in page offers.</p>
    <div>
      <Button href={signUpLink} size="sm">Sign up</Button>
    </div>
  {/if}
{/snippet}

<!-- The link is whichever half the visitor can do now: signed in, signing out;
     signed out, the sign-in page, which a session would only send on to the
     account. -->
{#snippet exploreAccount()}
  {#if user}
    <p>
      Edit your profile and how you sign in, then
      <SignOutLink>sign out</SignOutLink> and try another way in.
    </p>
    <div>
      <Button href="/account" size="sm" variant="outline">
        Go to your account
      </Button>
    </div>
  {:else}
    <p>
      Edit your profile and how you sign in, then sign out and try
      <a href={signInLink} class="text-foreground underline underline-offset-4"
        >another way in</a
      >.
    </p>
  {/if}
{/snippet}

{#snippet makeItYours()}
  <p>
    Edit <Code>src/routes/+page.svelte</Code>. Sign-in methods live in
    <Code>src/routes/auth/</Code>.
  </p>
{/snippet}

<CenteredLayout>
  <div class="mx-auto flex max-w-2xl flex-col gap-12 pt-[10vh] pb-6">
    <header class="flex flex-col items-center gap-3 text-center">
      <StackTitle />
      <p class="text-muted-foreground">
        An auth starter, rendered on the server.
      </p>
    </header>

    <section class="flex flex-col gap-6 self-center">
      <h2
        class="font-medium text-muted-foreground text-sm uppercase tracking-wide"
      >
        Get started
      </h2>
      <ol class="flex flex-col gap-8">
        {@render step(1, 'Create an account', createAccount)}
        {@render step(2, 'Explore your account', exploreAccount)}
        {@render step(3, 'Make it yours', makeItYours)}
      </ol>
    </section>
  </div>
</CenteredLayout>
