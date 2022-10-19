import axios, { AxiosInstance, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from 'axios'

import { getFunctionsUrlFromEnv, urlFromParams } from '../utils/helpers'
import { FunctionCallResponse } from '../utils/types'
export interface NhostFunctionsConstructorParams {
  /**
   * Serverless Functions endpoint.
   */
  url: string
  /**
   * Admin secret. When set, it is sent as an `x-hasura-admin-secret` header for all requests.
   */
  adminSecret?: string
}

/**
 * Get Nhost Functions Client
 *
 * @param adminSecret
 * @param urlParams
 * @returns
 */
export function getFunctionsClient(adminSecret: string | undefined, urlParams: any) {
  // default to the arguments passed directly
  const functionsUrl = urlFromParams(urlParams, 'functions')
  const functionsUrlFromEnv = getFunctionsUrlFromEnv()

  // if process.env.FUNCTIONS is set, use that instead
  return new NhostFunctionsClient({
    url: functionsUrlFromEnv ? functionsUrlFromEnv : functionsUrl,
    adminSecret
  })
}

/**
 * @alias Functions
 */
export class NhostFunctionsClient {
  private instance: AxiosInstance
  private accessToken: string | null
  private adminSecret?: string

  constructor(params: NhostFunctionsConstructorParams) {
    const { url, adminSecret } = params

    this.accessToken = null
    this.adminSecret = adminSecret
    this.instance = axios.create({
      baseURL: url
    })
  }

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
    data: D,
    config?: AxiosRequestConfig
  ): Promise<FunctionCallResponse<T>> {
    const headers = {
      ...this.generateAccessTokenHeaders(),
      ...config?.headers
    }

    let res
    try {
      res = await this.instance.post<T, AxiosResponse<T>, D>(url, data, { ...config, headers })
    } catch (error) {
      if (error instanceof Error) {
        return { res: null, error }
      }
    }

    if (!res) {
      return {
        res: null,
        error: new Error('Unable to make post request to funtion')
      }
    }

    return { res, error: null }
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

  private generateAccessTokenHeaders(): AxiosRequestHeaders {
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
