import type { AxiosResponse } from 'axios'
import { ErrorPayload } from '../../utils/types'

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

/** Subset of RequestInit parameters that are supported by the functions client */
export interface FunctionCallConfig {
  headers?: Record<string, string>
}
