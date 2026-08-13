import type { NextFunction, Request, Response } from "express";

// Express 4 does not catch rejected promises thrown inside async route
// handlers - an unhandled rejection there crashes the whole Node process
// (this took the entire backend down in production once, not just one
// request - see the P2028 transaction-timeout incident in upload.routes.ts).
// Wrapping every async handler in this forwards the error to errorHandler.ts
// instead, so one bad request returns a 500 rather than killing the server.
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Req, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
