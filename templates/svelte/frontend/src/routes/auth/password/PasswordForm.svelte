<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { afterSignIn } from '#routes/signin/afterSignIn.ts';
  import type { Intent } from '#routes/signin/intent.ts';
  import { signInQuery } from '#routes/signin/query.ts';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    requestPasswordReset,
    signIn,
    signUp,
    verifyMfa,
  } from './actions.remote.ts';
  import PasswordRequirements from './PasswordRequirements.svelte';
  import { meetsRequirements } from './requirements.ts';

  type Mode = 'sign-in' | 'sign-up';

  // What the form shows once a request has gone out and there is nothing more
  // to type: the next step happens in the visitor's inbox.
  type Sent = 'verification' | 'reset';

  let { next, intent }: { next: string; intent: Intent } = $props();

  const id = $props.id();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const codeId = `${id}-code`;
  const rulesId = `${id}-rules`;

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so a
  // sign-in form would be a dead end. Only where it opens: switching is the
  // visitor's from then on.
  // svelte-ignore state_referenced_locally
  let mode = $state<Mode>(intent);
  let email = $state('');
  let password = $state('');
  let sent = $state<Sent>();
  // Set when the password was right but the account has two-factor on: the
  // backend wants a code from the authenticator app before it issues a session.
  let mfaTicket = $state<string>();
  // Auth spends the ticket on every attempt, right or wrong, so a retry signs
  // in again with the same password for a fresh one.
  let ticketSpent = $state(false);
  let code = $state('');
  let codeInput = $state<HTMLInputElement | null>(null);
  let error = $state<string>();
  let isPending = $state(false);

  // The code is all there is to type once the step appears.
  $effect(() => {
    codeInput?.focus();
  });

  const finishSignIn = (): Promise<void> => afterSignIn(next);

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
    isPending = true;
    try {
      if (mode === 'sign-in') {
        const result = await signIn({ email, password });
        if (result.error) {
          error = result.error;
          return;
        }

        if (result.mfaTicket) {
          mfaTicket = result.mfaTicket;
          return;
        }

        await finishSignIn();
        return;
      }

      const result = await signUp({ email, password, next });
      if (result.error) {
        error = result.error;
        return;
      }

      if (result.signedIn) {
        await finishSignIn();
        return;
      }

      sent = 'verification';
    } catch (err) {
      console.error('Error submitting the form:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  const handleVerifyCode = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;
    isPending = true;
    try {
      let ticket = mfaTicket;
      if (ticketSpent) {
        const fresh = await signIn({ email, password });
        if (fresh.error) {
          error = fresh.error;
          return;
        }

        // Two-factor was turned off in the meantime: the password alone was
        // enough.
        if (!fresh.mfaTicket) {
          await finishSignIn();
          return;
        }

        ticket = fresh.mfaTicket;
        mfaTicket = ticket;
        ticketSpent = false;
      }

      const result = await verifyMfa({ ticket: ticket ?? '', otp: code });
      if (result.error) {
        ticketSpent = true;
        error = result.error;
        return;
      }

      await finishSignIn();
    } catch (err) {
      console.error('Error verifying the code:', err);
      ticketSpent = true;
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  // Keeps the email: going back is usually for the same account, with the
  // ticket lapsed or the authenticator not to hand.
  const startOver = (): void => {
    mfaTicket = undefined;
    ticketSpent = false;
    code = '';
    password = '';
    error = undefined;
  };

  const handleForgotPassword = async (): Promise<void> => {
    error = undefined;
    isPending = true;
    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        error = result.error;
        return;
      }

      sent = 'reset';
    } catch (err) {
      console.error('Error requesting the reset link:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };
</script>

{#if sent === 'verification'}
  <p class="text-muted-foreground text-sm">
    We sent a verification link to {email}. Opening it confirms the address
    and signs you in.
  </p>
{:else if sent === 'reset'}
  <p class="text-muted-foreground text-sm">
    If that address has an account, a reset link is on its way.
  </p>
{:else if mfaTicket}
  <form class="flex flex-col gap-4" onsubmit={handleVerifyCode}>
    <div class="flex flex-col gap-2">
      <Label for={codeId}>Authenticator code</Label>
      <Input
        bind:ref={codeInput}
        id={codeId}
        inputmode="numeric"
        autocomplete="one-time-code"
        required
        bind:value={code}
        disabled={isPending}
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button type="submit" disabled={isPending}>
      {isPending ? 'Verifying…' : 'Verify'}
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="self-start"
      disabled={isPending}
      onclick={startOver}
    >
      Start over
    </Button>
  </form>
{:else}
  <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
    <div class="flex flex-col gap-2">
      <Label for={emailId}>Email</Label>
      <Input
        id={emailId}
        type="email"
        autocomplete="email"
        required
        bind:value={email}
        disabled={isPending}
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for={passwordId}>Password</Label>
      <Input
        id={passwordId}
        type="password"
        autocomplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        required
        bind:value={password}
        disabled={isPending}
        aria-describedby={mode === 'sign-up' ? rulesId : undefined}
      />
      <!-- Only while signing up. Signing in, the password already exists, and
           whether it would pass today's rules is not the question. -->
      {#if mode === 'sign-up'}
        <PasswordRequirements id={rulesId} {password} />
      {/if}
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button
      type="submit"
      disabled={isPending || (mode === 'sign-up' && !meetsRequirements(password))}
    >
      {#if mode === 'sign-in'}
        {isPending ? 'Signing in…' : 'Sign in'}
      {:else}
        {isPending ? 'Signing up…' : 'Sign up'}
      {/if}
    </Button>

    <!-- Centred, not spread: signing up there is only one link here, and
         justify-between left it hard against the left edge of a card whose
         heading and button are both centred. -->
    <div class="flex flex-wrap items-center justify-center gap-4 text-sm">
      <Button
        type="button"
        variant="link"
        size="sm"
        class="h-auto p-0"
        disabled={isPending}
        onclick={switchMode}
      >
        {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
      </Button>
      {#if mode === 'sign-in'}
        <Button
          type="button"
          variant="link"
          size="sm"
          class="h-auto p-0"
          disabled={isPending || !email}
          onclick={() => void handleForgotPassword()}
        >
          Forgot your password?
        </Button>
      {/if}
    </div>
  </form>
{/if}
