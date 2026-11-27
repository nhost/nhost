<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/components/useSignOut';

const { error, isSigningOut, handleSignOut } = useSignOut();
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
