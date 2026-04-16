import type { Request, Response } from 'express';

const sharp = require('sharp');

export default (req: Request, res: Response) => {
  res.status(200).send(`ok`);
};
