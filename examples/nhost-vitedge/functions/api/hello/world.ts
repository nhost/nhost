// For a JS project, '.js' extension MUST be provided due to ESM limitations
import { ApiEndpoint } from 'vitedge'
import { staticImportTestWithExtension } from '../../utils/test1.js'
// For a TS project, '.js' extension can be optionally provided
import { staticImportTestWithoutExtension } from '../../utils/test2'
// JSON can be imported because --experimental-json-modules is provided in CLI dev
import json from '../../utils/test3.json'

export default <ApiEndpoint>{
  handler({ query, request }) {
    if (request.method !== 'GET') {
      throw new Error('Method not supported!')
    }

    return {
      // Actual data returned to frontend
      data: {
        msg: 'Hello world!',
        staticImportTestWithExtension,
        staticImportTestWithoutExtension,
        json,
      },
      // Dynamic options for this request
      options: {
        cache: {
          api: 90,
        },
      },
    }
  },
  // Default static options
  options: {
    cache: {
      api: 85,
    },
  },
}
