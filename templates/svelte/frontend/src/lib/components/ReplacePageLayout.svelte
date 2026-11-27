<!--
  @component
  Renders its children until a form under it swaps in a replacement page.
-->
<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { provideReplacePage } from './replacePage.ts';

  let { children }: { children: Snippet } = $props();

  let replaced = $state<{
    page: Component<Record<string, unknown>>;
    props: Record<string, unknown>;
  }>();

  provideReplacePage((page, props) => {
    replaced = {
      page: page as Component<Record<string, unknown>>,
      props,
    };
  });
</script>

{#if replaced}
  <replaced.page {...replaced.props} />
{:else}
  {@render children()}
{/if}
