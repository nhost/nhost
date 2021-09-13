export default {
  // Target: https://go.nuxtjs.dev/config-target
  target: "static",

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: "Nhost and Nuxt",
    htmlAttrs: {
      lang: "en"
    },
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { hid: "description", name: "description", content: "" }
    ],
    link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }]
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: ["@nhost/nuxt"],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    {
      src: "~/plugins/nhost-apollo-ws-client.js",
      mode: "client"
    }
  ],

  apollo: {
    clientConfigs: {
      default: "~/plugins/nhost-apollo-config.js"
    }
  },

  nhost: {
    baseURL: process.env.NHOST_BACKEND_URL,
    routes: {
      home: "/"
    }
  },

  router: {
    middleware: ["nhost/auth"]
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {}
};
