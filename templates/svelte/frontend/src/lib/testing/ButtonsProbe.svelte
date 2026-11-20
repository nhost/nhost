<!-- @component Stands in for a method's sign-in buttons in a test. -->
<script lang="ts">
  let { lastUsed }: { destination: string; lastUsed: string | null } =
    $props();
</script>

buttons told {lastUsed}
