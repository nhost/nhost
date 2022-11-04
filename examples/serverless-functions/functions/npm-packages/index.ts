/*

- How to use npm packages

Test:

curl http://localhost:1337/v1/functions/npm-packages
*/

import { Request, Response } from 'express'
import slugify from 'slugify'

export default (req: Request, res: Response) => {
  const text = 'The quick brown fox jumps over the lazy dog'
  const slug = slugify(text, {
    lower: true
  })

  res.status(200).send(slug)
}
