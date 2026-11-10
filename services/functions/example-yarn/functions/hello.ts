import type { Request, Response } from 'express';

export default (req: Request, res: Response) => {
  res
    .status(200)
    .set('Content-Type', 'text/plain')
    .send(`Hello, ${req.query.name || 'world'}!`);
};
