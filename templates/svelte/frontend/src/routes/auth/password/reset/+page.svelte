<!--
  The reset email's link goes through the auth service, which sends the user
  back here with a refresh token the server hook redeems only for a signed-out
  visitor.
-->
<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '#lib/components/ui/card/index.ts';
  import { passwordSignIn } from '../passwordSignIn.ts';
  import type { PageProps } from './$types';
  import ResetPasswordForm from './ResetPasswordForm.svelte';

  // The session's user, from the root layout.
  let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-sm">
  <Card>
    {#if !data.user}
      <CardHeader>
        <CardTitle>This link no longer works</CardTitle>
        <CardDescription>
          It has expired or was already used. Request another one and open it
          from the same browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button href={passwordSignIn}>Request a new link</Button>
      </CardContent>
    {:else}
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          You are signed in as {data.user.email ?? 'this account'}. Choose a new
          password for this account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    {/if}
  </Card>
</div>
