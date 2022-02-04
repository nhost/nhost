import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { FunctionCallResponse } from '../types'

export interface NhostFunctionsConstructorParams {
  url: string
}

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

  async call(url: string, data: any, config?: AxiosRequestConfig): Promise<FunctionCallResponse> {
    const headers = {
      ...this.generateAccessTokenHeaders(),
      ...config?.headers
    }

    let res
    try {
      res = await this.instance.post(url, data, { ...config, headers })
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
