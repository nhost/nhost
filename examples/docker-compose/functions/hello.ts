import { type Request, type Response } from 'express'
export default (req: Request, res: Response) => {
  res.status(200).send(`Hullo, ${req.query.name}!`)
}
