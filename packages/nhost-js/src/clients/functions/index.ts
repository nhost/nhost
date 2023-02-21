import fetch from 'cross-fetch'
import { urlFromSubdomain } from '../../utils/helpers'
import { NhostClientConstructorParams } from '../../utils/types'
import {
  NhostFunctionCallConfig,
  NhostFunctionCallResponse,
  NhostFunctionsConstructorParams
} from './types'
/**
 * Creates a client for Functions from either a subdomain or a URL
 */
export function createFunctionsClient(params: NhostClientConstructorParams) {
  const functionsUrl =
    'subdomain' in params || 'backendUrl' in params
      ? urlFromSubdomain(params, 'functions')
      : params.functionsUrl

  if (!functionsUrl) {
    throw new Error('Please provide `subdomain` or `functionsUrl`.')
  }

  return new NhostFunctionsClient({ url: functionsUrl, ...params })
}

/**
 * @alias Functions
 */
export class NhostFunctionsClient {
  readonly url: string
  private accessToken: string | null
  private adminSecret?: string

  constructor(params: NhostFunctionsConstructorParams) {
    const { url, adminSecret } = params

    this.url = url
    this.accessToken = null
    this.adminSecret = adminSecret
  }

  async call<T = unknown, D = any>(
    url: string,
    data: D,
    config?: NhostFunctionCallConfig
  ): Promise<NhostFunctionCallResponse<T>>

  /**
   * Use `nhost.functions.call` to call (sending a POST request to) a serverless function.
   *
   * @example
   * ```ts
   * await nhost.functions.call('send-welcome-email', { email: 'joe@example.com', name: 'Joe Doe' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/functions/call
   */
  async call<T = unknown, D = any>(
    url: string,
    body: D,
    config?: NhostFunctionCallConfig
  ): Promise<NhostFunctionCallResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...this.generateAccessTokenHeaders(),
      ...config?.headers
    }

    try {
      const result = await fetch(url, {
        body: JSON.stringify(body),
        headers,
        method: 'POST'
      })
      if (!result.ok) {
        throw new Error(result.statusText)
      }
      let data: T
      try {
        data = await result.json()
      } catch {
        data = (await result.text()) as unknown as T
      }
      return {
        res: { data, status: result.status, statusText: result.statusText },
        error: null
      }
    } catch (e) {
      const error = e as Error
      return {
        res: null,
        error: {
          message: error.message,
          status: error.name === 'AbortError' ? 0 : 500,
          error: error.name === 'AbortError' ? 'abort-error' : 'unknown'
        }
      }
    }
  }

  /**
   * Use `nhost.functions.setAccessToken` to a set an access token to be used in subsequent functions requests. Note that if you're signin in users with `nhost.auth.signIn()` the access token will be set automatically.
   *
   * @example
   * ```ts
   * nhost.functions.setAccessToken('some-access-token')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/functions/set-access-token
   */
  setAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      this.accessToken = null
      return
    }

    this.accessToken = accessToken
  }

  private generateAccessTokenHeaders(): NhostFunctionCallConfig['headers'] {
    if (this.adminSecret) {
      return {
        'x-hasura-admin-secret': this.adminSecret
      }
    }
    if (this.accessToken) {
      return {
        Authorization: `Bearer ${this.accessToken}`
      }
    }
    return {}
  }
}
