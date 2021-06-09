import { ApiEndpoint } from 'vitedge'

export default <ApiEndpoint>{
  async handler({ query, request, headers }) {
    if (request.method !== 'POST') {
      throw new Error('Method not supported!')
    }

    let body
    try {
      if (request.json) {
        body = await request.json()
      } else {
        // When running on Express.js, body should already be provided
        body = request.body
      }
    } catch (error) {
      console.error(error)
      body = {}
    }

    return {
      // Actual data returned to frontend
      data: {
        msg: 'Hello moto!',
        ...body,
      },
    }
  },
}
