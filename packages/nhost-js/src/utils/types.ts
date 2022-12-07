import { NhostAuthConstructorParams } from '@nhost/hasura-auth-js'

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
export interface FunctionResponse<T = any> {
  data: T
  status: number
  statusText: string
}

export type FunctionCallResponse<T = unknown> =
  | {
      res: FunctionResponse<T>
      error: null
    }
  | {
      res: null
      error: Error
    }

export interface GraphqlResponse<T = object> {
  errors?: object[]
  data?: T
}
