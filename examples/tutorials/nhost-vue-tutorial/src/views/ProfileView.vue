<template>
  <div v-if="isLoading" class="loading-container">
    <div class="loading-content">
      <div class="spinner"></div>
      <span class="loading-text">Loading...</span>
    </div>
  </div>

  <div v-else class="container">
    <header class="page-header">
      <h1 class="page-title">Your Profile</h1>
    </header>

    <div class="form-card">
      <h3 class="form-title">User Information</h3>
      <div class="form-fields">
        <div class="field-group">
          <strong>Display Name:</strong> {{ user?.displayName || "Not set" }}
        </div>
        <div class="field-group">
          <strong>Email:</strong> {{ user?.email || "Not available" }}
        </div>
        <div class="field-group">
          <strong>User ID:</strong> {{ user?.id || "Not available" }}
        </div>
        <div class="field-group">
          <strong>Roles:</strong> {{ user?.roles?.join(", ") || "None" }}
        </div>
        <div class="field-group">
          <strong>Email Verified:</strong>
          <span :class="user?.emailVerified ? 'email-verified' : 'email-unverified'">
            {{ user?.emailVerified ? "✓ Yes" : "✗ No" }}
          </span>
        </div>
      </div>
    </div>

    <div class="form-card">
      <h3 class="form-title">Session Information</h3>
      <div class="description">
        <pre class="session-display">{{ JSON.stringify(session, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from "../lib/nhost/auth";

const { user, session, isLoading } = useAuth();
</script>
