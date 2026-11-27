<script setup lang="ts">
import { listSessions } from '@/app/account/actions';
import SessionList from '@/app/account/SessionList.vue';
import { sortSessions } from '@/app/account/sessions';
import SettingsList from '@/components/SettingsList.vue';
import { Card } from '@/components/ui/card';
import { useLoad } from '@/lib/useLoad';

/** The account's sessions, each with a way to end it. */
const loaded = useLoad(listSessions);
</script>

<template>
  <Card class="gap-0 py-0">
    <h2 class="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
      Sessions
    </h2>
    <SettingsList>
      <li
        v-if="!loaded"
        class="flex min-h-12 items-center px-5 py-2 text-muted-foreground text-xs"
      >
        Loading…
      </li>
      <li
        v-else-if="loaded.error"
        role="alert"
        class="px-5 py-3 text-destructive text-sm"
      >
        {{ loaded.error }}
      </li>
      <SessionList v-else :sessions="sortSessions(loaded.sessions ?? [])" />
    </SettingsList>
  </Card>
</template>
