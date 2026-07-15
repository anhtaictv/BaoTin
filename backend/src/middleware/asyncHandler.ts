import type { NextFunction, Request, Response } from "express";

/** Express 4 doesn't catch rejected promises from async route handlers — this forwards them to errorHandler. */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}
