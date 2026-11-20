<!-- @component Stands in for a method's account-page row in a test. -->
<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';

  let { user }: { user: User } = $props();
</script>

<li>Setting for {user.id}</li>
