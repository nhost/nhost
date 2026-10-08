<script setup lang="ts">
import { computed } from 'vue';
import OAuthButtons from '@/auth/oauth/OAuthButtons.vue';
import { providers } from '@/auth/oauth/providers';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/auth';
import { appOrigin } from '@/lib/nhost/env';
import OtherWaysLink from '@/signin/OtherWaysLink.vue';
import { signInQuery } from '@/signin/query';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

/**
 * Sign in with a provider account.
 *
 * This is a redirect, not a request: each button sends the browser to the
 * auth service, which does the provider round-trip and comes back to
 * `redirectTo` with a refresh token on the URL, or with an error when the
 * provider is not enabled or the sign-in was refused. `lib/nhost/linkToken.ts`
 * handles both when the app loads again, redeeming the token or putting the
 * error in the notice above the page, so this page never sees the callback.
 */
const { nhost } = useAuth();
const next = useNext();
const intent = useIntent();
const query = computed(() => signInQuery(next.value, intent.value));

const links = computed(() =>
  providers.map(({ id, label }) => ({
    id,
    label,
    href: nhost.auth.signInProviderURL(id, {
      redirectTo: appOrigin() + next.value,
    }),
  })),
);
</script>

<template>
  <div class="mx-auto max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>GitHub or Google</CardTitle>
        <CardDescription>Sign in with a provider account.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <OAuthButtons :links="links" />
        <p class="text-muted-foreground text-sm">
          A provider only works once it is enabled in <code>nhost.toml</code>.
          The README's OAuth section has the callback URL and the config.
        </p>
        <OtherWaysLink :query="query" />
      </CardContent>
    </Card>
  </div>
</template>
