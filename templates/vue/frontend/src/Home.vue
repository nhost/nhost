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
          {{ user ? 'You are signed in' : 'You are not signed in' }}
        </CardTitle>
        <CardDescription>
          {{
            user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Create an account, or sign in to one you already have.'
          }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex gap-2">
        <Button v-if="user" as-child>
          <RouterLink to="/protected">Open the protected page</RouterLink>
        </Button>
        <template v-else>
          <!-- Sign up first: a fresh local backend has no accounts in it. -->
          <Button as-child>
            <RouterLink to="/signin">Sign up</RouterLink>
          </Button>
          <Button as-child variant="outline">
            <RouterLink to="/signin?intent=sign-in">Sign in</RouterLink>
          </Button>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
