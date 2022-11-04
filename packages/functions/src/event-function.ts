import { RequestHandler } from 'express'

import { HasuraEventPayload, HasuraEventRow, HasuraEventType } from './types'
import { ErrorRequestHandler, webhookGuard, wrapErrors } from './utils'

export type EventFunctionOptions<T extends HasuraEventType = 'UNKNOWN'> = T | { event: T }

type EventHandler<R extends HasuraEventRow, E extends HasuraEventType> = RequestHandler<
  {},
  {},
  HasuraEventPayload<R, E>,
  {}
>
type EventFunctionResult<R extends HasuraEventRow, E extends HasuraEventType> = EventHandler<R, E>[]

// * A bit repetitive workaround to the fact that Typescript doesn't support partial type parameter inference
// * https://stackoverflow.com/questions/57589098/infer-one-of-generic-types-from-function-argument/57595649#57595649

export function eventFunction<R extends HasuraEventRow, E extends HasuraEventType = 'UNKNOWN'>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<R extends HasuraEventRow, E extends HasuraEventType = 'INSERT'>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<R extends HasuraEventRow, E extends HasuraEventType = 'UPDATE'>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

export function eventFunction<R extends HasuraEventRow, E extends HasuraEventType = 'DELETE'>(
  options: EventFunctionOptions<E>,
  handler: EventHandler<R, E>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, E>

// TODO Should we support the 'MANUAL' event type?
export function eventFunction<R extends HasuraEventRow>(
  options: EventFunctionOptions,
  handler: EventHandler<R, 'UNKNOWN'>,
  errorHandler?: ErrorRequestHandler
): EventFunctionResult<R, 'UNKNOWN'> {
  return wrapErrors([webhookGuard, handler], errorHandler)
}
