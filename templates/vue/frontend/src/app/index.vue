<script setup lang="ts">
import { computed } from 'vue';
import Step from '@/app/Step.vue';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import CenteredLayout from '@/components/CenteredLayout.vue';
import Code from '@/components/Code.vue';
import SignOutLink from '@/components/SignOutLink.vue';
import StackTitle from '@/components/StackTitle.vue';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/nhost/auth';

/** The starter's front page: what this is and what to try first. */
const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

const session = useSession();
const user = computed(() => session.value?.user);
</script>

<template>
  <CenteredLayout>
    <div class="mx-auto flex max-w-2xl flex-col gap-12 pt-[10vh] pb-6">
      <header class="flex flex-col items-center gap-3 text-center">
        <StackTitle />
        <p class="text-muted-foreground">
          An auth starter, rendered in the browser.
        </p>
      </header>

      <section class="flex flex-col gap-6 self-center">
        <h2
          class="font-medium text-muted-foreground text-sm uppercase tracking-wide"
        >
          Get started
        </h2>
        <ol class="flex flex-col gap-8">
          <Step :n="1" title="Create an account">
            <p v-if="user">
              Done: you are signed in as {{ user.email ?? user.id }}.
            </p>
            <template v-else>
              <p>Sign up with any of the ways the sign-in page offers.</p>
              <div>
                <Button as-child size="sm">
                  <RouterLink :to="signUpLink">Sign up</RouterLink>
                </Button>
              </div>
            </template>
          </Step>

          <Step :n="2" title="Explore your account">
            <!-- The link is whichever half the visitor can do now: signed in,
                 signing out; signed out, the sign-in page, which a session
                 would only send on to the account. -->
            <p v-if="user">
              Edit your profile and how you sign in, then
              <SignOutLink>sign out</SignOutLink> and try another way in.
            </p>
            <p v-else>
              Edit your profile and how you sign in, then sign out and try
              <RouterLink
                :to="signInLink"
                class="text-foreground underline underline-offset-4"
                >another way in</RouterLink
              >.
            </p>
            <div v-if="user">
              <Button as-child size="sm" variant="outline">
                <RouterLink to="/account">Go to your account</RouterLink>
              </Button>
            </div>
          </Step>

          <Step :n="3" title="Make it yours">
            <p>
              Edit <Code>src/app/index.vue</Code>. Sign-in methods live in
              <Code>src/app/auth/</Code>.
            </p>
          </Step>
        </ol>
      </section>
    </div>
  </CenteredLayout>
</template>
