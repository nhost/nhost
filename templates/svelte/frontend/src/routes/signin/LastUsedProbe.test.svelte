<!-- @component Stands in for a method's sign-in buttons in page.test.ts. -->
<script lang="ts">
  let { lastUsed }: { destination: string; lastUsed: string | null } =
    $props();
</script>

buttons told {lastUsed}
