<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/nhost/auth';

const { nhost } = useAuth();
const router = useRouter();

const error = ref<string | undefined>();
const isSigningOut = ref(false);

const handleSignOut = async (): Promise<void> => {
  error.value = undefined;
  isSigningOut.value = true;
  try {
    // Clears the stored session, which the session watch in
    // `lib/nhost/watchSession.ts` hears in this tab and every other one, so
    // they all drop to signed out without this having to tell them.
    await nhost.auth.signOut({
      refreshToken: nhost.getUserSession()?.refreshToken ?? '',
    });

    await router.push('/');
  } catch (err) {
    console.error('Error signing out:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isSigningOut.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <Button
      type="button"
      variant="outline"
      size="sm"
      :disabled="isSigningOut"
      @click="handleSignOut"
    >
      {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
    </Button>
    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>
  </div>
</template>
