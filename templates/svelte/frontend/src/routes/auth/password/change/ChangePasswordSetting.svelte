<!--
  The value is a mask, not a fact: the auth service never says whether an
  account has a password, and one made by magic link has none until it is set
  here.
-->
<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import DialogSetting from '#lib/components/DialogSetting.svelte';
  import ChangePasswordForm from './ChangePasswordForm.svelte';

  let { user }: { user: User } = $props();

  const staysSignedIn = $derived(Boolean(user.email));
</script>

<DialogSetting
  label="Password"
  value="••••••••"
  action="Change"
  title="Change password"
  description={staysSignedIn
    ? "Your other devices will be signed out. You'll stay signed in here."
    : "You'll be signed out everywhere, this device included."}
>
  <ChangePasswordForm needsCode={user.activeMfaType === 'totp'} />
</DialogSetting>
