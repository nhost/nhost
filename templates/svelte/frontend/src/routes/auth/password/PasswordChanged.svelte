<!--
  @component
  In place of the page a password change signed this browser out from. The nav
  takes the sign-out from this card while it is up, until the next page loads.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { signedOutHere } from '#lib/components/signedOutHere.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '#lib/components/ui/card/index.ts';
  import { passwordSignIn } from './passwordSignIn.ts';

  onMount(() => {
    signedOutHere.current = true;
    return () => {
      signedOutHere.current = false;
    };
  });
</script>

<div class="mx-auto max-w-sm">
  <Card>
    <CardHeader>
      <CardTitle>Password changed</CardTitle>
      <CardDescription>
        Changing it signed you out everywhere, this browser included. Sign in
        again with the new password.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button href={passwordSignIn}>Sign in</Button>
    </CardContent>
  </Card>
</div>
