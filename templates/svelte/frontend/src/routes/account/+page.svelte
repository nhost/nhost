<script lang="ts">
  import Code from '#lib/components/Code.svelte';
  import SettingsList from '#lib/components/SettingsList.svelte';
  import { Card } from '#lib/components/ui/card/index.ts';
  import type { PageProps } from './$types';
  import DeleteAccountSetting from './DeleteAccountSetting.svelte';
  import ProfileSummary from './ProfileSummary.svelte';
  import SessionsCard from './SessionsCard.svelte';
  import SignInSettings from './SignInSettings.svelte';

  let { data }: PageProps = $props();
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-4">
  <ProfileSummary user={data.user} />
  <SignInSettings user={data.user} />
  <SessionsCard />
  <!-- Untitled: the label says what the row is, and the dialog it opens spells
       out what the button does. -->
  <Card class="gap-0 py-0">
    <SettingsList>
      <DeleteAccountSetting />
    </SettingsList>
  </Card>

  <p class="mt-2 text-center text-muted-foreground text-sm">
    Edit this page in <Code>src/routes/account/</Code>.
  </p>
</div>
