<template>
  <div>
    Login <br /><br />
    <input type="text" placeholder="Email" v-model="email"> <br /><br />
    <input type="password" placeholder="Password" v-model="password"> <br /><br />
    <input type="button" @click="submit" value="Login">
  </div>
</template>

<script>
export default {
  nhostAuth: 'guest',
  data: () => ({
    email: '',
    password: '',
  }),
  methods: {
    submit() {
      this.$nhost.auth.login({ email: this.email, password: this.password }).then(() => {
        this.$router.push(this.$nhost.$options.routes.home);
      });
    },
  }
}
</script>
