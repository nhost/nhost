import { AxiosResponse } from 'axios'

export type GraphqlRequestResponse =
  | {
      data: null
      error: Error | object
    }
  | {
      data: unknown
      error: null
    }

export type FunctionCallResponse =
  | {
      res: AxiosResponse
      error: null
    }
  | {
      res: null
      error: Error
    }

export interface GraphqlResponse {
  errors?: object[]
  data?: object
}
