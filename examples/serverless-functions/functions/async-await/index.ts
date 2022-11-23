/*

- How to use async/await.

Test:

curl http://localhost:1337/v1/functions/async-await
*/

import fetch from 'cross-fetch'
import { Request, Response } from 'express'

// using async in the function signature
export default async (req: Request, res: Response) => {
  // using await
  const result = await fetch('//api.github.com/repos/nhost/nhost')

  if (result.status >= 400) {
    throw new Error('Bad response from server')
  }

  const repo = await result.json()

  res.json(repo)
}
