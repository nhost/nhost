import { RequestHandler } from 'express'

import {
  allowCorsMiddleware,
  ErrorRequestHandler,
  nhostUserInformationMiddleware,
  roleGuard,
  wrapErrors
} from './utils'

export interface NhostFunctionOptions {
  /**
   * Roles that are allowed to access this function.
   * If not specified, the function is accessible to all roles.
   */
  roles?: string[] | string
  /**
   * Enable CORS for browsers
   * @default false
   */
  allowCors?: boolean
}

/**
 * Nhost function wrapper
 * @param options options of the function, such as allowed roles and cors
 * @param handler the function handler
 * @param errorHandler the error handler
 * @example
 * ```ts
 * import { nhostFunction } from '@nhost/functions-helpers'
 *
 * export default nhostFunction({ roles: ['user'] }, (req, res) => {
 *   console.log(req.role)
 *   res.send("this function can be run with the 'user' role")
 * })
 * ```
 */
export function nhostFunction<
  P = Record<string, string>,
  ResultBody = any,
  RequestBody = any,
  RequestQuery = any
>(
  options: NhostFunctionOptions,
  handler: RequestHandler<P, ResultBody, RequestBody, RequestQuery>,
  errorHandler?: ErrorRequestHandler
): RequestHandler<P, ResultBody, RequestBody, RequestQuery>[]

/**
 * Nhost function wrapper
 * @param handler the function handler
 * @param errorHandler the error handler
 * @example
 *  ```ts
 * import { nhostFunction } from '@nhost/functions-helpers'
 *
 * export default nhostFunction<{ id: string; created_at: string; value: number }>(
 *   (req, res) => {
 *     // Typed according to the generic type
 *     console.log(req.body.id, req.body.value)
 *   }
 * )
 * ```
 * @example
 * ```ts
 * import { nhostFunction } from '@nhost/functions-helpers'
 *
 * export default nhostFunction((req, res) => {
 *   // Returns the decoded user claims, if any
 *   console.log(req.userClaims)
 *   // Returns `true` if there is the hasura admin secret of if the user role is admin
 *   console.log(req.isAdmin)
 *   // Returns the `x-hasura-role` value or 'admin' if the hasura admin secret is set
 *   console.log(req.role)
 *   res.send(`User id: ${req.userClaims?.['x-hasura-user-id']}`)
 * })
 * ```
 */
export function nhostFunction<
  P = Record<string, string>,
  ResultBody = any,
  RequestBody = any,
  RequestQuery = any
>(
  handler: RequestHandler<P, ResultBody, RequestBody, RequestQuery>,
  errorHandler?: ErrorRequestHandler<P, ResultBody, RequestBody, RequestQuery>
): RequestHandler<P, ResultBody, RequestBody, RequestQuery>[]

export function nhostFunction(...args: any[]) {
  let handler: RequestHandler
  let errorHandler: ErrorRequestHandler
  const internalHandlers: RequestHandler[] = [nhostUserInformationMiddleware]

  if (typeof args[0] === 'function') {
    handler = args[0]
    errorHandler = args[1]
  } else {
    const { roles, allowCors }: NhostFunctionOptions = args[0]
    handler = args[1]
    errorHandler = args[2]
    if (allowCors) {
      internalHandlers.push(allowCorsMiddleware)
    }
    if (roles) {
      internalHandlers.push(roleGuard(roles))
    }
  }

  return wrapErrors([...internalHandlers, handler], errorHandler)
}
