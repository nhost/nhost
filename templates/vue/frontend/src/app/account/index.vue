<script setup lang="ts">
import { computed } from 'vue';
import CenteredLayout from '@/components/CenteredLayout.vue';
import { useSession } from '@/lib/nhost/auth';

const session = useSession();
const email = computed(() => session.value?.user?.email);
</script>

<template>
  <CenteredLayout>
    <p class="text-muted-foreground text-sm">Signed in as {{ email }}.</p>
  </CenteredLayout>
</template>
