import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

import { FunctionCallResponse } from '../utils/types'
export interface NhostFunctionsConstructorParams {
  url: string
}

/**
 * @alias Functions
 */
export class NhostFunctionsClient {
  private instance: AxiosInstance
  private accessToken: string | null

  constructor(params: NhostFunctionsConstructorParams) {
    const { url } = params

    this.accessToken = null
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

  private generateAccessTokenHeaders(): { Authorization: string } | undefined {
    if (!this.accessToken) {
      return
    }

    // eslint-disable-next-line consistent-return
    return {
      Authorization: `Bearer ${this.accessToken}`
    }
  }
}
