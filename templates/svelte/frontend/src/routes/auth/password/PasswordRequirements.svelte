<!-- @component The rules a new password has to meet, ticked off as it is typed. -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { passwordRequirements } from './requirements.ts';

  let {
    id,
    password,
    confirm,
    class: className,
  }: {
    id: string;
    password: string;
    confirm?: string;
    class?: string;
  } = $props();
</script>

<!-- items-center so each rule centres as a unit, tick and all, under a card
     whose heading and button are centred too. -->
<ul {id} class={cn('flex flex-col items-center gap-1 text-sm', className)}>
  {#each passwordRequirements(password, confirm) as rule (rule.label)}
    <!-- A dash while a rule is still open, so the list does not read as a row
         of failures before anything is typed. Green once it is met. -->
    <li
      class={cn(
        'flex items-center gap-1.5',
        rule.met ? 'text-success' : 'text-muted-foreground',
      )}
    >
      <span aria-hidden="true" class="flex w-2.5 justify-center font-bold">
        {#if rule.met}
          ✓
        {:else}
          <span class="h-0.5 w-2 rounded-full bg-muted-foreground/60"></span>
        {/if}
      </span>
      <span>{rule.label}</span>
      <!-- The tick is decoration; this is the same state as words. -->
      <span class="sr-only">{rule.met ? 'met' : 'not met'}</span>
    </li>
  {/each}
</ul>
