<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import { computed, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import DeleteAccountSetting from '@/app/account/DeleteAccountSetting.vue';
import ProfileSummary from '@/app/account/ProfileSummary.vue';
import SessionsCard from '@/app/account/SessionsCard.vue';
import SignInSettings from '@/app/account/SignInSettings.vue';
import { signInHref } from '@/app/signin/destination';
import Code from '@/components/Code.vue';
import SettingsList from '@/components/SettingsList.vue';
import { Card } from '@/components/ui/card';
import { getVerifiedUser, nhost } from '@/lib/nhost/client';
import { useLoad } from '@/lib/useLoad';

const router = useRouter();

// The guard only reads the stored session, which any script on the page can
// write, so it redirects the signed-out but proves nothing.
const verified = useLoad(getVerifiedUser);

// A reload that comes back empty keeps the account on screen: whatever ended
// the session navigates away on its own.
const last = shallowRef<User | null>(null);
const user = computed(() => verified.value?.user ?? last.value);
watch(user, (current) => {
  last.value = current;
});

// Anything but a refusal says nothing about the session, and sending it to the
// sign-in page, which sends a session here, would loop until it ends.
const refusal = computed(() => {
  const answer = verified.value;
  if (user.value || !answer || answer.user) {
    return null;
  }
  return answer.reason === 'unavailable' ? 'unavailable' : 'refused';
});

// A stored session the auth service turned down was revoked or never real.
// Cleared first, or the sign-in page would send the visitor straight back.
watch(refusal, (reason) => {
  if (reason === 'refused') {
    nhost.sessionStorage.remove();
    void router.replace(signInHref('/account'));
  }
});
</script>

<template>
  <div v-if="user" class="mx-auto flex max-w-2xl flex-col gap-4">
    <ProfileSummary :user="user" />
    <SignInSettings :user="user" />
    <SessionsCard />
    <!-- Untitled: the label says what the row is, and the dialog it opens
         spells out what the button does. -->
    <Card class="gap-0 py-0">
      <SettingsList>
        <DeleteAccountSetting />
      </SettingsList>
    </Card>

    <p class="mt-2 text-center text-muted-foreground text-sm">
      Edit this page in <Code>src/app/account/</Code>.
    </p>
  </div>
  <p
    v-else-if="refusal === 'unavailable'"
    role="alert"
    class="mx-auto max-w-2xl text-center text-destructive text-sm"
  >
    Could not load your account. Reload the page to try again.
  </p>
</template>
