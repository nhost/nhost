<template>
  <div class="login-container">
    <h2>Register</h2>
    <form @submit="register">
      <label for="email">Email</label>
      <br />
      <input type="email" name="email" v-model="email" />
      <br /><br />
      <label for="password">Password</label>
      <br />
      <input type="password" name="password" v-model="password" />
      <br /><br />
      <button type="submit">Submit</button>
    </form>
  </div>
  <br />
  <router-link to="/login">Or login</router-link>
</template>

<script>
import { auth } from "../utils/nhost";
export default {
  data() {
    return {
      email: "",
      password: "",
    };
  },
  methods: {
    async register(event) {
      event.preventDefault();
      try {
        const result = await auth.register({
          email: this.$data.email,
          password: this.$data.password,
        });

        if (result.user) {
          this.$router.push("/");
        } else throw new Error("Register Unsuccessful");
      } catch (e) {
        alert(e);
      }
    },
  },
};
</script>
