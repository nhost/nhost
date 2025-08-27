import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  // if accept is not set or set to text/plain, return plain text
  if (!req.headers.accept || req.headers.accept === 'text/plain') {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send('Hello, World!')
  }

  // if accept is set to application/json, return JSON
  if (req.headers.accept === 'application/json') {
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ message: 'Hello, World!' })
  }

  // fail with 400
  res.setHeader('Content-Type', 'text/plain')
  res.status(400).send('Unsupported Accept Header')
}
