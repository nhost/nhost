<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/auth';

const { session } = useAuth();

const user = computed(() => session.value?.user);
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>
          {{ user ? 'You are signed in' : 'You are signed out' }}
        </CardTitle>
        <CardDescription>
          {{
            user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Pick a sign-in method to get a session.'
          }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex gap-2">
        <Button as-child>
          <RouterLink :to="user ? '/protected' : '/signin'">
            {{ user ? 'Open the protected page' : 'Sign in' }}
          </RouterLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
