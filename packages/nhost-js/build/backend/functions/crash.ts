import type { Request, Response } from "express";

export default (_: Request, _res: Response) => {
  throw new Error("This is an unhandled error");
};
