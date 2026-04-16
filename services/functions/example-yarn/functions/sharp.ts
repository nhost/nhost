import type { Request, Response } from 'express';

const _sharp = require('sharp');

export default (_req: Request, res: Response) => {
  res.status(200).send(`ok`);
};
