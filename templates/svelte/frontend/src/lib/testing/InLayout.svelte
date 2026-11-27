<!--
  @component
  Renders `page` inside `layout`, the way SvelteKit nests a page in its layout,
  so a test can swap the page and keep the layout.
-->
<script lang="ts">
  import type { Component } from 'svelte';

  let {
    layout: Layout,
    page: Page,
    props = {},
  }: {
    // A route layout's props include its data, which a test has no use for.
    // biome-ignore lint/suspicious/noExplicitAny: any layout, given children
    layout: Component<any>;
    // biome-ignore lint/suspicious/noExplicitAny: any page, with its own props
    page: Component<any>;
    props?: Record<string, unknown>;
  } = $props();
</script>

<Layout><Page {...props} /></Layout>
