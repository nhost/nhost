import { Request, Response } from "express";

export default (_: Request, res: Response) => {
  throw new Error("This is an unhandled error");
};
