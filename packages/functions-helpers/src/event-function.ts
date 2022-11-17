import { RequestHandler } from 'express'

import { HasuraEventColumnValues, HasuraEventPayload, HasuraEventType } from './hasura-metadata'
import { ErrorRequestHandler, webhookGuard, wrapErrors } from './utils'

export type EventFunctionOptions<T extends HasuraEventType = 'MANUAL'> = T | { event: T }

type EventHandler<R extends HasuraEventColumnValues, E extends HasuraEventType> = RequestHandler<
  {},
  {},
  HasuraEventPayload<R, E>,
  {}
>
type EventFunctionResult<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType
> = EventHandler<R, E>[]

// * The following overrides are a bit repetitive workaround to the fact that Typescript doesn't support partial type parameter inference
// * https://stackoverflow.com/questions/57589098/infer-one-of-generic-types-from-function-argument/57595649#57595649

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType = 'MANUAL'
>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType = 'INSERT'
>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType = 'UPDATE'
>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType = 'DELETE'
>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType = 'MULTIPLE'
>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

/**
 * Creates a function that can be used as a webhook handler for Hasura event triggers
 * @param options The event type(s) to handle
 * @param handler The handler function
 * @param errorHandler The error handler function
 * @returns
 */
export function eventFunction<R extends HasuraEventColumnValues>(
  _options: EventFunctionOptions,
  handler: EventHandler<R, 'MANUAL'>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, 'MANUAL'> {
  return wrapErrors([webhookGuard, handler], errorHandler)
}
