/*

- How to create a Serverless Function in TypeScript.

Test:

curl http://localhost:1337/v1/functions/hello-world
*/

import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  res.status(200).send(`Hello world`)
}
