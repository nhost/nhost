/*

- How to use query parameters

Test:

curl http://localhost:1337/v1/functions/query-parameters\?name\=johan
*/

import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  res.status(200).send(`Hello ${req.query.name}!`)
}
