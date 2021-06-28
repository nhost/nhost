<template>
  <div class="login login-container">
    <h2>Login</h2>
    <form @submit="sendLoginRequest">
      <label for="email">Email</label>
      <br />
      <input type="text" name="email" v-model="email" />
      <br />
      <br />
      <label for="email">Password</label>
      <br />
      <input type="password" name="password" v-model="password" />
      <br />
      <br />
      <button>Submit</button>
    </form>
  </div>
  <br />
  <router-link to="/register">Or register</router-link>
</template>

<script>
import { ref } from "@vue/reactivity";
import { auth } from "../utils/nhost.js";
import { useRouter } from "vue-router";

export default {
  setup() {
    let email = ref("");
    let password = ref("");

    const router = useRouter();

    const sendLoginRequest = async (event) => {
      event.preventDefault();

      const authResult = await auth.login({
        email: email.value,
        password: password.value,
      });

      if (authResult.user) {
        router.push("/");
      } else {
        alert("Incorrect login.");
      }
    };

    return {
      email,
      password,
      sendLoginRequest,
    };
  },
};
</script>
