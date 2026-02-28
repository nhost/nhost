import type { Request, Response } from "express";
import cors from "cors";

const corsMiddleware = cors();

export default (req: Request, res: Response) => {
  corsMiddleware(req, res, () => {
    res.status(200).json({ message: "Hello from a CORS-enabled function!" });
  });
};
