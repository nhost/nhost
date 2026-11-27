<!-- @component The account's sessions, each with a way to end it. -->
<script lang="ts">
  import SettingsList from '#lib/components/SettingsList.svelte';
  import { Card } from '#lib/components/ui/card/index.ts';
  import { listSessions } from './actions.remote.ts';
  import SessionList from './SessionList.svelte';
  import { sortSessions } from './sessions.ts';

  const { sessions, error } = $derived(await listSessions());
</script>

<Card class="gap-0 py-0">
  <h2 class="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
    Sessions
  </h2>
  <SettingsList>
    {#if error}
      <li role="alert" class="px-5 py-3 text-destructive text-sm">{error}</li>
    {:else}
      <SessionList sessions={sortSessions(sessions ?? [])} />
    {/if}
  </SettingsList>
</Card>
