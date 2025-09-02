<script lang="ts">
import type { Snippet } from "svelte";

interface Props {
  passwordTabContent: Snippet;
  magicTabContent: Snippet;
  socialTabContent?: Snippet;
  webauthnTabContent?: Snippet;
}

let {
  passwordTabContent,
  magicTabContent,
  socialTabContent,
  webauthnTabContent,
}: Props = $props();

let activeTab: "password" | "magic" | "social" | "webauthn" =
  $state("password");
</script>

<div>
  <div class="tabs-container">
    <button
      class="tab-button {activeTab === 'password' ? 'tab-active' : ''}"
      onclick={() => (activeTab = "password")}
    >
      Email + Password
    </button>
    <button
      class="tab-button {activeTab === 'magic' ? 'tab-active' : ''}"
      onclick={() => (activeTab = "magic")}
    >
      Magic Link
    </button>
    {#if socialTabContent}
      <button
        class="tab-button {activeTab === 'social' ? 'tab-active' : ''}"
        onclick={() => (activeTab = "social")}
      >
        Social
      </button>
    {/if}
    {#if webauthnTabContent}
      <button
        class="tab-button {activeTab === 'webauthn' ? 'tab-active' : ''}"
        onclick={() => (activeTab = "webauthn")}
      >
        Security Key
      </button>
    {/if}
  </div>

  <div class="tab-content">
    {#if activeTab === "password"}
      {@render passwordTabContent()}
    {:else if activeTab === "magic"}
      {@render magicTabContent()}
    {:else if activeTab === "social" && socialTabContent}
      {@render socialTabContent()}
    {:else if activeTab === "webauthn" && webauthnTabContent}
      {@render webauthnTabContent()}
    {/if}
  </div>
</div>
