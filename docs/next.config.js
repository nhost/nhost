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
      }
    ]
  }
}
