/*

- How to use environment variables.

Test:

curl http://localhost:1337/v1/functions/env-vars
*/

import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  // System environment variable
  // docs.nhost.io/platform/environment-variables#system-environment-variables
  console.log('NHOST_ADMIN_SECRET:')
  console.log(process.env.NHOST_ADMIN_SECRET)

  // Custom environment variable defined in `.env.development` and in the Nhost Dashboard (prod).
  console.log('MY_TEST:')
  console.log(process.env.MY_TEST)

  res
    .status(200)
    .send('See the logs using `nhost logs -f` (locally) or in the Nhost Dashboard (prod)')
}
