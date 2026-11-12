import type { Request, Response } from 'express';
import { createGreeting } from '../shared/greeting.ts';
import type { Greeting } from '../shared/types.ts';

export default function sharedGreeting(
  _req: Request,
  res: Response<Greeting>,
): void {
  res.json(createGreeting('function'));
}
