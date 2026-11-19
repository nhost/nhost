<script setup lang="ts">
import { computed } from 'vue';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { methods } from '@/app/signin/methods';
import { signInQuery } from '@/app/signin/query';
import NavAccount from '@/components/NavAccount.vue';
import NhostLogo from '@/components/NhostLogo.vue';
import SignOutButton from '@/components/SignOutButton.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/nhost/auth';

const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;

const signedOutPaths = methods.flatMap((method) => method.signedOutPaths ?? []);

const session = useSession();
const user = computed(() => session.value?.user);
</script>

<template>
  <nav
    class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
  >
    <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
      <RouterLink
        to="/"
        class="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NhostLogo class="size-5" />
        Nhost
      </RouterLink>

      <NavAccount :signed-in="!!user" :signed-out-paths="signedOutPaths">
        <template v-if="user" #signed-in>
          <div class="flex items-center gap-3">
            <SignOutButton />
            <RouterLink
              to="/account"
              class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserAvatar
                :avatar-url="user.avatarUrl"
                :display-name="user.displayName"
                :width="64"
                class="size-8 text-xs"
              />
              <span class="sr-only">Your account</span>
            </RouterLink>
          </div>
        </template>
        <template #signed-out>
          <div class="flex items-center gap-3">
            <Button as-child variant="outline" size="sm">
              <RouterLink :to="signInLink">Sign in</RouterLink>
            </Button>
            <Button as-child size="sm">
              <RouterLink :to="signUpLink">Sign up</RouterLink>
            </Button>
          </div>
        </template>
      </NavAccount>
    </div>
  </nav>
</template>
