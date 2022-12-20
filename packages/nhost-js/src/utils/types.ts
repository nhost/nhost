import { NhostAuthConstructorParams } from '@nhost/hasura-auth-js'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { GraphQLError } from 'graphql'

// TODO shared with other packages
export type ErrorPayload = {
  error: string
  status: number
  message: string
}

export type { NhostAuthConstructorParams }

export type BackendUrl = {
  /**
   * Nhost backend URL
   * Will be deprecated in a future release. Please look at 'subdomain' and 'region' instead.
   */
  backendUrl: string
}

export type Subdomain = {
  /**
   * Project subdomain (e.g. `ieingiwnginwnfnegqwvdqwdwq`)
   * Use `localhost` during local development
   */
  subdomain: string

  /**
   * Project region (e.g. `eu-central-1`)
   * Project region is not required during local development (when `subdomain` is `localhost`)
   */
  region?: string
  /**
   * When set, the admin secret is sent as a header, `x-hasura-admin-secret`,
   * for all requests to GraphQL, Storage, and Serverless Functions.
   */
  adminSecret?: string
}

export type ServiceUrls = {
  authUrl?: string
  graphqlUrl?: string
  storageUrl?: string
  functionsUrl?: string
}

export type BackendOrSubdomain = BackendUrl | Subdomain

export interface NhostClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Partial<ServiceUrls>,
    Omit<NhostAuthConstructorParams, 'url'> {
  /**
   * When set, the admin secret is sent as a header, `x-hasura-admin-secret`,
   * for all requests to GraphQL, Storage, and Serverless Functions.
   */
  adminSecret?: string
}

export type GraphqlRequestResponse<T = unknown> =
  | {
      data: null
      error: GraphQLError[] | ErrorPayload
    }
  | {
      data: T
      error: null
    }

/**@deprecated */
export type DeprecatedGraphqlRequestResponse<T = unknown> =
  | {
      data: null
      error: Error | object | object[]
    }
  | {
      data: T
      error: null
    }

export type FunctionCallResponse<T = unknown> =
  | {
      res: {
        data: T
        status: number
        statusText: string
      }
      error: null
    }
  | {
      res: null
      error: ErrorPayload
    }

/**@deprecated */
export type DeprecatedFunctionCallResponse<T = unknown> =
  | {
      res: AxiosResponse<T>
      error: null
    }
  | {
      res: null
      error: Error
    }

export interface GraphqlResponse<T = object> {
  errors?: GraphQLError[]
  data?: T
}

export type NhostFetchConfig = { headers?: Record<string, string> }
export type AxiosConfig = AxiosRequestConfig
