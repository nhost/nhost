<template>
  <div v-if="!registered">
    Register <br /><br />
    <input type="text" placeholder="Email" v-model="email"> <br /><br />
    <input type="password" placeholder="Password" v-model="password"> <br /><br />
    <input type="button" @click="submit" value="Register">
  </div>
  <div v-else>
    registered!!
  </div>
</template>

<script>
export default {
  data: () => ({
    email: '',
    password: '',
    registered: false,
  }),
  methods: {
    submit() {
      this.$nhost.auth.register({ email: this.email, password: this.password }).then(() => {
        this.registered = true;
      });
    }
  }
}
</script>
