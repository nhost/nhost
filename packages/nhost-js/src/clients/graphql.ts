import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import type { DocumentNode } from 'graphql'
import { print } from 'graphql/language/printer'

import { GraphqlRequestResponse, GraphqlResponse } from '../types'

export interface NhostGraphqlConstructorParams {
  url: string
}

export class NhostGraphqlClient {
  private url: string
  private instance: AxiosInstance
  private accessToken: string | null

  constructor(params: NhostGraphqlConstructorParams) {
    const { url } = params

    this.url = url
    this.accessToken = null
    this.instance = axios.create({
      baseURL: url
    })
  }

  async request<T = any, V = any>(
    document: string | DocumentNode,
    variables?: V,
    config?: AxiosRequestConfig
  ): Promise<GraphqlRequestResponse<T>> {
    // add auth headers if any
    const headers = {
      ...config?.headers,
      ...this.generateAccessTokenHeaders()
    }

    try {
      const operationName = ''
      const res = await this.instance.post<GraphqlResponse<T>>(
        '',
        {
          operationName: operationName || undefined,
          query: typeof document === 'string' ? document : print(document),
          variables
        },
        { ...config, headers }
      )

      const responseData = res.data
      const { data } = responseData

      if (responseData.errors) {
        return {
          data: null,
          error: responseData.errors
        }
      }

      if (typeof data !== 'object' || Array.isArray(data) || data === null) {
        return {
          data: null,
          error: new Error('incorrect response data from GraphQL server')
        }
      }

      return { data, error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { data: null, error }
      }
      console.error(error)
      return {
        data: null,
        error: new Error('Unable to get do GraphQL request')
      }
    }
  }

  getUrl(): string {
    return this.url
  }

  setAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      this.accessToken = null
      return
    }

    this.accessToken = accessToken
  }

  private generateAccessTokenHeaders() {
    if (!this.accessToken) {
      return
    }

    // eslint-disable-next-line consistent-return
    return {
      Authorization: `Bearer ${this.accessToken}`
    }
  }
}
