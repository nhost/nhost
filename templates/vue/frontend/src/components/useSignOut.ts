import { type Ref, ref } from 'vue';
import { useRouter } from 'vue-router';
import { signOut } from '@/lib/nhost/actions';

/**
 * Signs out and goes home, for every control that offers it: the nav's button,
 * the link in the home page's steps, and this session's line on the account
 * page.
 */
export function useSignOut(): {
  error: Ref<string | undefined>;
  isSigningOut: Ref<boolean>;
  handleSignOut: () => Promise<void>;
} {
  const router = useRouter();
  const error = ref<string>();
  const isSigningOut = ref(false);

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut.value) {
      return;
    }
    isSigningOut.value = true;
    try {
      const result = await signOut();

      if (result.stillSignedIn) {
        error.value = result.error;
        return;
      }

      error.value = undefined;
      await router.replace('/');
    } finally {
      isSigningOut.value = false;
    }
  };

  return { error, isSigningOut, handleSignOut };
}
