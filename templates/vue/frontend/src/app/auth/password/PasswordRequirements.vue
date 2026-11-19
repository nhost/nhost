<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';
import { passwordRequirements } from '@/app/auth/password/requirements';
import { cn } from '@/lib/utils';

/** The rules a new password has to meet, ticked off as it is typed. */
const props = defineProps<{
  id: string;
  password: string;
  confirm?: string;
  class?: HTMLAttributes['class'];
}>();

const rules = computed(() =>
  passwordRequirements(props.password, props.confirm),
);
</script>

<template>
  <!-- items-center so each rule centres as a unit, tick and all, under a card
       whose heading and button are centred too. -->
  <ul
    :id="id"
    :class="cn('flex flex-col items-center gap-1 text-sm', props.class)"
  >
    <!-- A dash while a rule is still open, so the list does not read as a row
         of failures before anything is typed. Green once it is met. -->
    <li
      v-for="rule in rules"
      :key="rule.label"
      :class="
        cn(
          'flex items-center gap-1.5',
          rule.met ? 'text-success' : 'text-muted-foreground',
        )
      "
    >
      <span aria-hidden="true" class="flex w-2.5 justify-center font-bold">
        <template v-if="rule.met">✓</template>
        <span v-else class="h-0.5 w-2 rounded-full bg-muted-foreground/60" />
      </span>
      <span>{{ rule.label }}</span>
      <!-- The tick is decoration; this is the same state as words. -->
      <span class="sr-only">{{ rule.met ? 'met' : 'not met' }}</span>
    </li>
  </ul>
</template>
