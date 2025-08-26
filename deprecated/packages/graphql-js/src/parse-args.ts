import { RequestDocument, RequestOptions, Variables } from './types'

export function parseRequestArgs<V extends Variables = Variables>(
  documentOrOptions: RequestDocument | RequestOptions<V>,
  variables?: V,
  config?: RequestInit
): RequestOptions<V> {
  return (
    (documentOrOptions as RequestOptions<V>).document
      ? documentOrOptions
      : {
          document: documentOrOptions,
          variables,
          config
        }
  ) as RequestOptions<V>
}
