import { Request, Response } from 'express'
import process from 'process'

export default (req: Request, res: Response) => {
  return res.status(200).json({
    headers: req.headers,
    query: req.query,
    node: process.version
  })
}
