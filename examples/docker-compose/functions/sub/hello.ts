import { type Request, type Response } from 'express'
export default (req: Request, res: Response) => {
  res.status(200).send(`Hello from a subdirectory, ${req.query.name}!`)
}
