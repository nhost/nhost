/*

- How to import a function (`add`) from a utils folder.

Test:

curl http://localhost:1337/v1/functions/helper-function \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"a": 3, "b": 2}'
*/

import { Request, Response } from 'express'

import { add } from '../_utils/helpers'

export default (req: Request, res: Response) => {
  const { a, b } = req.body
  const sum = add(a, b)

  res.status(200).send(`sum is ${sum} from /math/add`)
}
