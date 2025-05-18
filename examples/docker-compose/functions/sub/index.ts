import { type Request, type Response } from 'express'
export default (_req: Request, res: Response) => {
  res.status(200).send(`Index function in a sub-directory`)
}
