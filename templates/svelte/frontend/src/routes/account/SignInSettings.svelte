<!-- @component Every sign-in method, as the account page shows it. -->
<script lang="ts" module>
  // "a", "a and b", "a, b and c".
  function sentenceList(items: string[]): string {
    if (items.length < 2) {
      return items[0] ?? '';
    }
    return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  }
</script>

<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import DialogSetting from '#lib/components/DialogSetting.svelte';
  import SettingsList from '#lib/components/SettingsList.svelte';
  import { Card } from '#lib/components/ui/card/index.ts';
  import { buttonSettings, methods } from '#routes/signin/methods.ts';
  import ChangeEmailForm from './ChangeEmailForm.svelte';

  let { user }: { user: User } = $props();

  const unmanaged = methods.filter((method) => !method.account);
  const settings = methods.flatMap((method) =>
    Object.entries(method.account ?? {}).map(([name, Setting]) => ({
      key: `${method.href}#${name}`,
      Setting,
    })),
  );
</script>

{#snippet email()}
  {#if user.email}
    {user.email}{#if !user.emailVerified}<span class="text-destructive">
        · not verified</span
      >{/if}
  {:else}
    None
  {/if}
{/snippet}

<Card class="gap-0 py-0">
  <h2 class="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
    Sign-in
  </h2>
  <SettingsList>
    <DialogSetting
      label="Email"
      value={email}
      action="Change"
      title="Change email"
      description="We'll send a link to the new address to confirm it."
    >
      <ChangeEmailForm email={user.email} verified={user.emailVerified} />
    </DialogSetting>
    {#each settings as { key, Setting } (key)}
      <Setting {user} />
    {/each}
    {#each buttonSettings as Setting, index (index)}
      <Setting {user} />
    {/each}
  </SettingsList>
  {#if unmanaged.length > 0}
    <p class="border-t px-5 py-3 text-muted-foreground text-xs">
      {`${sentenceList(unmanaged.map((method) => method.title))} also ${unmanaged.length === 1 ? 'signs' : 'sign'} in to this account, no additional set up needed.`}
    </p>
  {/if}
</Card>
