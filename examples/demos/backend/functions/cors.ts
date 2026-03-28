import type { Request, Response } from "express";

export default (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  res.status(200).json({
    message: "Hello from a CORS-enabled function!",
    origin: req.headers.origin || "no origin header",
    method: req.method,
  });
};
