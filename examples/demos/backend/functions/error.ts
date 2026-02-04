import type { Request, Response } from "express";
import cors from "cors";

const corsMiddleware = cors();

export default (req: Request, res: Response) => {
  corsMiddleware(req, res, () => {
    try {
      throw new Error("This is a handled error");
    } catch (error) {
      console.log(error);
      res.status(500).json({
        error: error.message,
      });
    }
  });
};
