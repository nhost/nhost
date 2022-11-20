import { RequestHandler } from 'express'

import { HasuraEventColumnValues, HasuraEventPayload, HasuraEventType } from './hasura-metadata'
import { webhookGuard, wrapErrors } from './utils'

type SpecifiableHasuraEventType = Exclude<HasuraEventType, 'UNKNOWN'>

export type EventFunctionOptions<T extends SpecifiableHasuraEventType> = T | { event: T }

type EventHandler<R extends HasuraEventColumnValues, E extends HasuraEventType> = RequestHandler<
  {},
  {},
  HasuraEventPayload<R, E>,
  {}
>
type EventFunctionResult<R extends HasuraEventColumnValues, E extends HasuraEventType> =
  | EventHandler<R, E>[]
  | EventHandler<R, E>

// * The following overrides are a bit repetitive workaround to the fact that Typescript doesn't support partial type parameter inference
// * https://stackoverflow.com/questions/57589098/infer-one-of-generic-types-from-function-argument/57595649#57595649

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends HasuraEventType = 'UNKNOWN'
>(handler: EventHandler<R, E>): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends SpecifiableHasuraEventType = 'MANUAL'
>(options: EventFunctionOptions<E>, handler: EventHandler<R, E>): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends SpecifiableHasuraEventType = 'INSERT'
>(options: EventFunctionOptions<E>, handler: EventHandler<R, E>): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends SpecifiableHasuraEventType = 'UPDATE'
>(options: EventFunctionOptions<E>, handler: EventHandler<R, E>): EventFunctionResult<R, E>

export function eventFunction<
  R extends HasuraEventColumnValues,
  E extends SpecifiableHasuraEventType = 'DELETE'
>(options: EventFunctionOptions<E>, handler: EventHandler<R, E>): EventFunctionResult<R, E>

/**
 * Creates a function that can be used as a webhook handler for Hasura event triggers
 * @param options The event type(s) to handle
 * @param handler The handler function
 * @param errorHandler The error handler function
 * @returns
 */
export function eventFunction<R extends HasuraEventColumnValues>(
  ...args: any[]
): EventFunctionResult<R, 'MANUAL'> {
  let handler: EventHandler<R, 'MANUAL'>
  // let options: EventFunctionOptions
  if (args.length === 1) {
    handler = args[0]
  } else {
    //  options = args[0]
    handler = args[1]
  }
  return wrapErrors(
    [
      webhookGuard,
      (req, res, err) => {
        handler(req, res, err)
        return res.status(200).send({ success: true })
      }
    ],
    (error, _, res) => res.status(error.status).send({ success: false, message: error.message })
  )
}
