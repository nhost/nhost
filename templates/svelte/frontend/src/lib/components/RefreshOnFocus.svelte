<!--
  @component
  Loads the page again when a signed-in tab is returned to after a while. A tab
  left open never navigates, so coming back to it is what lets the server hook
  see a session revoked from another device.
-->
<script lang="ts">
  import { invalidate, refreshAll } from '$app/navigation';
  import { FOCUS_REFRESH_MS, SESSION_DEPENDENCY } from './refreshOnFocus.ts';

  let { signedIn }: { signedIn: boolean } = $props();

  // The layout's load first: its request is the one that refreshes the
  // session, and the queries that load after it only read the cookie.
  const reload = async (): Promise<void> => {
    await invalidate(SESSION_DEPENDENCY);
    await refreshAll();
  };

  $effect(() => {
    if (!signedIn) {
      return;
    }

    let last = Date.now();
    const onReturn = (): void => {
      if (
        document.visibilityState !== 'visible' ||
        Date.now() - last < FOCUS_REFRESH_MS
      ) {
        return;
      }
      last = Date.now();
      void reload();
    };

    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  });
</script>
