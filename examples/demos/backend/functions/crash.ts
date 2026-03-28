import type { Request, Response } from "express";
import cors from "cors";

const corsMiddleware = cors();

export default (req: Request, res: Response) => {
  corsMiddleware(req, res, () => {
    throw new Error("This is an unhandled error");
  });
};
