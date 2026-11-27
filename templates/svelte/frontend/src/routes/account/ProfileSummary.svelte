<script lang="ts" module>
  // A fixed locale and zone rather than the visitor's: this renders on the
  // server, which knows neither, and the day it says has to be the one the auth
  // service stored.
  const joined = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
</script>

<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import UserAvatar from '#lib/components/UserAvatar.svelte';
  import { Card } from '#lib/components/ui/card/index.ts';
  import AvatarForm from './AvatarForm.svelte';
  import CopyUserId from './CopyUserId.svelte';
  import DisplayNameField from './DisplayNameField.svelte';

  let { user }: { user: User } = $props();
</script>

<Card class="flex-row items-center gap-5 p-5">
  <!-- Nothing to take down when the account has no avatar at all. -->
  <AvatarForm canRemove={Boolean(user.avatarUrl)}>
    <UserAvatar
      avatarUrl={user.avatarUrl}
      displayName={user.displayName}
      width={192}
      class="size-18 text-2xl"
    />
  </AvatarForm>

  <!-- The id, role and locale are what a developer reads and the account's
       owner mostly does not, so they are small. -->
  <div
    class="grid min-w-0 flex-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3"
  >
    <div class="min-w-0">
      <DisplayNameField displayName={user.displayName} />
    </div>
    <div class="flex min-w-0">
      <CopyUserId id={user.id} />
    </div>
    <div
      class="flex min-w-0 flex-col items-start gap-0.5 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:items-end sm:justify-center"
    >
      <p class="whitespace-nowrap text-muted-foreground text-sm">
        Joined {joined.format(new Date(user.createdAt))}
      </p>
      <!-- The role is the default one on its own: `user.roles` always carries
           `me` as well, which says nothing here. -->
      <p
        class="max-w-full truncate text-muted-foreground/70 text-xs sm:whitespace-nowrap"
      >
        Role
        <span class="font-medium text-muted-foreground">{user.defaultRole}</span
        >
        · Locale
        <span class="font-medium text-muted-foreground">{user.locale}</span>
      </p>
    </div>
  </div>
</Card>
