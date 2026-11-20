<script lang="ts">
  import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
  } from '@simplewebauthn/browser';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { afterSignIn } from '#routes/signin/afterSignIn.ts';
  import type { Intent } from '#routes/signin/intent.ts';
  import { signInQuery } from '#routes/signin/query.ts';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    beginSignIn,
    beginSignUp,
    finishSignIn,
    finishSignUp,
  } from './actions.remote.ts';
  import { wasCancelled } from './cancelled.ts';
  import { deviceName } from './manage/names.ts';
  import { rememberPasskey } from './thisDevice.ts';

  type Mode = 'sign-in' | 'sign-up';

  let { next, intent }: { next: string; intent: Intent } = $props();

  const emailId = $props.id();

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so a
  // sign-in form would be a dead end. Only where it opens: switching is the
  // visitor's from then on.
  // svelte-ignore state_referenced_locally
  let mode = $state<Mode>(intent);
  let email = $state('');
  let sent = $state(false);
  let error = $state<string>();
  let isPending = $state(false);

  const finishNavigation = (): Promise<void> => afterSignIn(next);

  const switchMode = (): void => {
    const other = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    mode = other;
    error = undefined;
    // "Other ways to sign in" is built from the URL, so the URL has to say
    // which mode the visitor switched to.
    void goto(`${page.url.pathname}${signInQuery(next, other)}`, {
      replace: true,
      reset: false,
    });
  };

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;

    if (!browserSupportsWebAuthn()) {
      error = 'This browser does not support passkeys.';
      return;
    }

    isPending = true;
    try {
      if (mode === 'sign-in') {
        const begun = await beginSignIn();
        if (begun.error || !begun.options) {
          error = begun.error ?? 'Could not start sign in.';
          return;
        }

        const credential = await startAuthentication({
          optionsJSON: begun.options,
        });
        const result = await finishSignIn(credential);
        if (result.error) {
          error = result.error;
          return;
        }
        // So the account page knows this device holds it.
        rememberPasskey(credential.id);

        await finishNavigation();
        return;
      }

      const begun = await beginSignUp({ email, next });
      if (begun.error || !begun.options) {
        error = begun.error ?? 'Could not start sign up.';
        return;
      }

      const credential = await startRegistration({
        optionsJSON: begun.options,
      });
      const result = await finishSignUp({
        credential,
        next,
        nickname: deviceName(navigator.userAgent),
      });
      if (result.error) {
        error = result.error;
        return;
      }
      rememberPasskey(credential.id);

      if (result.signedIn) {
        await finishNavigation();
        return;
      }

      sent = true;
    } catch (err) {
      if (wasCancelled(err)) {
        error = 'The passkey prompt was cancelled.';
        return;
      }

      console.error('Error completing the passkey ceremony:', err);
      error = 'The passkey could not be used. Try again.';
    } finally {
      isPending = false;
    }
  };
</script>

{#if sent}
  <p class="text-muted-foreground text-sm">
    Your passkey is registered. We sent a verification link to {email}.
    Opening it confirms the address and signs you in.
  </p>
{:else}
  <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
    {#if mode === 'sign-up'}
      <div class="flex flex-col gap-2">
        <Label for={emailId}>Email</Label>
        <Input
          id={emailId}
          type="email"
          autocomplete="email webauthn"
          required
          bind:value={email}
          disabled={isPending}
        />
      </div>
    {:else}
      <p class="text-muted-foreground text-sm">
        Your browser will offer the passkeys it holds for this site.
      </p>
    {/if}

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button type="submit" disabled={isPending}>
      {#if mode === 'sign-in'}
        {isPending ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
      {:else}
        {isPending ? 'Creating your passkey…' : 'Create a passkey'}
      {/if}
    </Button>

    <Button
      type="button"
      variant="link"
      size="sm"
      class="h-auto self-start p-0"
      disabled={isPending}
      onclick={switchMode}
    >
      {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
    </Button>
  </form>
{/if}
