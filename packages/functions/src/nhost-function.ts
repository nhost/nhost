import { RequestHandler } from 'express'

import { ErrorRequestHandler, nhostUserInformationMiddleware, roleGuard, wrapErrors } from './utils'

export interface NhostFunctionOptions {
  roles?: string[] | string
  cors?: boolean
}

/*

import { nhostFunction } from '@nhost/functions'

export default nhostFunction(
  async (req, res) => {
		// Returns the decoded access token, or undefined
    console.log(req.accessToken)

		// Returns `true` if there is the hasura admin secret of if the role is admin
    console.log(req.isAdmin)
		// Returns the `x-hasura-role` value or 'admin' if the hasura admin secret is set
    console.log(req.role)

  }
)


import { nhostFunction } from '@nhost/functions'

export default nhostFunction(
  { roles: ['user', 'admin', 'public', 'anonymous', 'any'] },
  async (req, res) => {
		 req.accessToken is the decoded access token. Type:
		 - `undefined` if roles are ['public'] or [] or undefined
		 - `undefined | AccessToken` if roles include 'admin' or 'any'
		 - `AccessToken` if roles don't include 'public' nor 'admin'
         console.log(req.accessToken)

         // Returns `true` if there is the hasura admin secret of if the role is admin
     console.log(req.isAdmin)
         // Returns the `x-hasura-role` value or 'admin' if the hasura admin secret is set
     console.log(req.role)
   }
 )



 ```tsx
import { nhostFunction } from '@nhost/functions'

export default nhostFunction<{ id: string; created_at: string; value: number }>(
  async (req, res) => {
    // Typed according to the generic type
    console.log(req.body.id, req.body.value)
  }
)
```
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
  //   TODO CORS
  const internalHandlers: RequestHandler[] = [nhostUserInformationMiddleware]

  if (typeof args[0] === 'function') {
    handler = args[0]
    errorHandler = args[1]
  } else {
    const { roles }: NhostFunctionOptions = args[0]
    handler = args[1]
    errorHandler = args[2]

    if (roles) {
      internalHandlers.push(roleGuard(roles))
    }
  }

  return wrapErrors([...internalHandlers, handler], errorHandler)
}
