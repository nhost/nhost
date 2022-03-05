module.exports = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/get-started',
        permanent: false
      },
      {
        source: '/tutorials',
        destination: '/get-started',
        permanent: false
      },
      {
        source: '/reference/sdk/javascript-sdk',
        destination: '/reference/sdk',
        permanent: false
      },
      {
        source: '/platform/authentication/social-login',
        destination: '/platform/authentication/social-sign-in',
        permanent: false
      }
    ]
  }
}
