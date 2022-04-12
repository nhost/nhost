import { Request, Response } from 'express'

const handler = async (req: Request, res: Response) => {
  console.log(process.env)
  res.status(200).send(`OK`)
}

export default handler
