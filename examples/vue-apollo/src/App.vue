<template>
  <q-layout view="hHh lpr fFf">
    <q-header elevated class="text-white bg-primary">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg" />
          </q-avatar>
          Nhost Vue/Quasar demo
        </q-toolbar-title>
      <q-btn v-if="isAuthenticated" flat round dense icon="logout" @click="() => signOut()" />
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
      <!-- drawer content -->
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts">
import { useAuthenticated, useSignOut } from '@nhost/vue'
import { defineComponent, ref } from 'vue'

export default defineComponent({
  setup() {
    const leftDrawerOpen = ref(false)
    const isAuthenticated = useAuthenticated()
    const { signOut, isSuccess: signedOut } = useSignOut()

    return {
      isAuthenticated,
      signedOut,
      signOut,
      leftDrawerOpen,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
})
</script>
