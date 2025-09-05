<template>
  <div>
    <div class="tabs-container">
      <button
        class="tab-button"
        :class="{ 'tab-active': activeTab === 'password' }"
        @click="activeTab = 'password'"
      >
        Email + Password
      </button>
      <button
        class="tab-button"
        :class="{ 'tab-active': activeTab === 'magic' }"
        @click="activeTab = 'magic'"
      >
        Magic Link
      </button>
      <button
        v-if="$slots['social']"
        class="tab-button"
        :class="{ 'tab-active': activeTab === 'social' }"
        @click="activeTab = 'social'"
      >
        Social
      </button>
      <button
        v-if="$slots['webauthn']"
        class="tab-button"
        :class="{ 'tab-active': activeTab === 'webauthn' }"
        @click="activeTab = 'webauthn'"
      >
        Security Key
      </button>
    </div>

    <div class="tab-content">
      <div v-if="activeTab === 'password'">
        <slot name="password"></slot>
      </div>
      <div v-else-if="activeTab === 'magic'">
        <slot name="magic"></slot>
      </div>
      <div v-else-if="activeTab === 'social'">
        <slot name="social"></slot>
      </div>
      <div v-else-if="activeTab === 'webauthn'">
        <slot name="webauthn"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

type TabType = "password" | "magic" | "social" | "webauthn";

const activeTab = ref<TabType>("password");
</script>
