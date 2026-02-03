import process from "node:process";
import type { Request, Response } from "express";
import cors from "cors";

const corsMiddleware = cors();

export default (req: Request, res: Response) => {
  corsMiddleware(req, res, () => {
    res.status(200).json({
      headers: req.headers,
      query: req.query,
      body: req.body,
      method: req.method,
      node: process.version,
      arch: process.arch,
      invocationId: req.invocationId,
    });
  });
};
