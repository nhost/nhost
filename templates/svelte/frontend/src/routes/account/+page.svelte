<script lang="ts">
  import Code from '#lib/components/Code.svelte';
  import UserAvatar from '#lib/components/UserAvatar.svelte';
  import { Card } from '#lib/components/ui/card/index.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const user = $derived(data.user);
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-4">
  <Card class="flex-row items-center gap-5 p-5">
    <UserAvatar
      avatarUrl={user.avatarUrl}
      displayName={user.displayName}
      width={192}
      class="size-18 text-2xl"
    />
    <p class="text-muted-foreground text-sm">{user.email}</p>
  </Card>

  <p class="mt-2 text-center text-muted-foreground text-sm">
    Edit this page in <Code>src/routes/account/</Code>.
  </p>
</div>
