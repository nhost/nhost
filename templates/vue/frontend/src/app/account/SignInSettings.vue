<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import ChangeEmailForm from '@/app/account/ChangeEmailForm.vue';
import { buttonSettings, methods } from '@/app/signin/methods';
import DialogSetting from '@/components/DialogSetting.vue';
import SettingsList from '@/components/SettingsList.vue';
import { Card } from '@/components/ui/card';

/** Every sign-in method, as the account page shows it. */
defineProps<{ user: User }>();

// "a", "a and b", "a, b and c".
function sentenceList(items: string[]): string {
  if (items.length < 2) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

const unmanaged = methods.filter((method) => !method.account);
const settings = methods.flatMap((method) =>
  Object.entries(method.account ?? {}).map(([name, setting]) => ({
    key: `${method.href}#${name}`,
    setting,
  })),
);
</script>

<template>
  <Card class="gap-0 py-0">
    <h2 class="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
      Sign-in
    </h2>
    <SettingsList>
      <DialogSetting
        label="Email"
        action="Change"
        title="Change email"
        description="We'll send a link to the new address to confirm it."
      >
        <template #value>
          <template v-if="user.email">
            {{ user.email
            }}<span v-if="!user.emailVerified" class="text-destructive">
              · not verified</span
            >
          </template>
          <template v-else>None</template>
        </template>
        <ChangeEmailForm :email="user.email" :verified="user.emailVerified" />
      </DialogSetting>
      <component
        :is="setting"
        v-for="{ key, setting } in settings"
        :key="key"
        :user="user"
      />
      <component
        :is="setting"
        v-for="(setting, index) in buttonSettings"
        :key="`buttons#${index}`"
        :user="user"
      />
    </SettingsList>
    <p
      v-if="unmanaged.length > 0"
      class="border-t px-5 py-3 text-muted-foreground text-xs"
    >
      {{
        `${sentenceList(unmanaged.map((method) => method.title))} also ${unmanaged.length === 1 ? 'signs' : 'sign'} in to this account, no additional set up needed.`
      }}
    </p>
  </Card>
</template>
