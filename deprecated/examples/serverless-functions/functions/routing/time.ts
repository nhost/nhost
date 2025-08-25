/*

Test:

curl http://localhost:1337/v1/functions/routing/time
*/

import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  const d = new Date()
  const time = d.toString()
  res.status(200).send(`File: /routing/time.ts. Endpoint: /routing/time: ${time}`)
}
