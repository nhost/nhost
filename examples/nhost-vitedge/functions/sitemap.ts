export default {
  handler({ query, body, request }) {
    if (request.method !== 'GET') {
      throw new Error('Method not supported!')
    }

    const url = new URL(request.url)
    const { origin } = url

    return {
      data: ['/', '/about'].map((path) => origin + path).join('\n'),
    }
  },
  options: {
    headers: { 'content-type': 'text/plain' },
    cache: {
      api: 85,
    },
  },
}
