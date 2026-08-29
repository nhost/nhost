import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  const webhookSecret = process.env.GRAPHITE_WEBHOOK_SECRET;
  console.log(`webhookSecret: ${webhookSecret}`)
  console.log(req.headers)
  if ( req.headers['x-graphite-webhook-secret'] !== webhookSecret ) {
    return res.status(401).send('Unauthorized');
  }

  if ( req.body.question?.match(/(world|life|universe)/i) ) {
    return res.status(200).send('42')
  }

  res.status(200).send(`I don't know`)
}

