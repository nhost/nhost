<script setup lang="ts">
import { passwordSignIn } from '@/app/auth/password/passwordSignIn';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card>
      <CardHeader>
        <CardTitle>Password changed</CardTitle>
        <CardDescription>
          Changing it signed you out everywhere, this browser included. Sign in
          again with the new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child>
          <RouterLink :to="passwordSignIn">Sign in</RouterLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
