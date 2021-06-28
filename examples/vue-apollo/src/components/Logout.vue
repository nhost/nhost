<template>
  <div>
    <button type="button" @click="logout">Logout</button>
  </div>
</template>

<script>
import { auth } from "../utils/nhost";
export default {
  methods: {
    async logout() {
      await auth.logout();
      window.location.assign("/login");
    },
  },
};
</script>
