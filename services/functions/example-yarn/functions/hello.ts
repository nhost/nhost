import type { Request, Response } from 'express';

export default (req: Request, res: Response) => {
  res.status(200).send(`Hello, ${req.query.name || 'world'}!`);
};
