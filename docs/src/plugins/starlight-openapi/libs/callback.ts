import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Operation } from './operation'

export function getCallbacks(operation: Operation): Callbacks | undefined {
  if ('callbacks' in operation) {
    return operation.callbacks
  }

  return
}

export function getCallbackObject(callbacks: Callbacks, identifier: keyof Callbacks) {
  return callbacks[identifier] as CallbackObject
}

type Callbacks = NonNullable<OpenAPIV3.OperationObject['callbacks'] | OpenAPIV3_1.OperationObject['callbacks']>
type CallbackObject = OpenAPIV3.CallbackObject
type CallbackUrl = keyof CallbackObject
export type Callback = CallbackObject[CallbackUrl]
