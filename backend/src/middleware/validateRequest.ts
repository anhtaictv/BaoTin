import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type RequestPart = "body" | "query" | "params";

/** Validates req[part] against a zod schema; replaces it with the parsed (typed, defaulted) value. */
export function validateRequest(schema: ZodTypeAny, part: RequestPart = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      });
      return;
    }
    (req as Record<RequestPart, unknown>)[part] = result.data;
    next();
  };
}
