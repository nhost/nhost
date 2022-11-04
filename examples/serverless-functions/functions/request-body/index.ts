/*

- How to use the request body

Test:

curl http://localhost:1337/v1/functions/request-body \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"name": "johan"}'
*/

import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  res.status(200).send(`Hello ${req.body.name}!`)
}
