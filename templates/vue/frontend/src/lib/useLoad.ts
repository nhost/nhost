import { type Ref, shallowRef, watch } from 'vue';
import { useAuth } from '@/lib/nhost/auth';

/**
 * What `load` last resolved to, or undefined until it first does. Loads on
 * setup and again whenever `useRefresh()` is called; an answer that arrives
 * after a newer load started, or after the page left, is dropped.
 */
export function useLoad<T>(
  load: () => Promise<T>,
): Readonly<Ref<T | undefined>> {
  const value = shallowRef<T>();

  watch(
    useAuth().load,
    (_key, _before, onCleanup) => {
      let current = true;
      onCleanup(() => {
        current = false;
      });
      load().then(
        (loaded) => {
          if (current) {
            value.value = loaded;
          }
        },
        (err: unknown) => console.error('Could not load the page:', err),
      );
    },
    { immediate: true },
  );

  return value;
}
