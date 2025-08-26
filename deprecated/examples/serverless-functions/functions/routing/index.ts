/*

Test:

curl http://localhost:1337/v1/functions/routing
*/

import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  res.status(200).send(`File: /routing/index.ts. Endpoint: /routing`)
}
