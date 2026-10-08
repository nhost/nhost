<script setup lang="ts">
import PasswordForm from '@/auth/password/PasswordForm.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useNext } from '@/signin/useNext';

const next = useNext();
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Email and password</CardTitle>
        <CardDescription>
          Sign in, or sign up and confirm your address by email.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <PasswordForm :next="next" />
        <RouterLink
          to="/signin"
          class="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Other ways to sign in
        </RouterLink>
      </CardContent>
    </Card>
  </div>
</template>
