import process from "node:process";
import type { Request, Response } from "express";

export default (req: Request, res: Response) => {
  res.status(200).json({
    headers: req.headers,
    query: req.query,
    node: process.version,
    arch: process.arch,
    invocationId: req.invocationId,
  });
};
