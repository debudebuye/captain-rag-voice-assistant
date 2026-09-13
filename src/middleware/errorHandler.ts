import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../shared/errors';
import { logger } from '../shared/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.details !== undefined) {
      logger.debug({ code: err.code, path: req.originalUrl, details: err.details }, err.message);
    }
    logger.warn({ code: err.code, path: req.originalUrl }, err.message);

    // Only structured validation issues are safe to surface to the client.
    // Raw upstream error messages stay server-side.
    const safeDetails = err instanceof ValidationError ? err.details : undefined;

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(safeDetails !== undefined ? { details: safeDetails } : {}),
      },
    });
    return;
  }

  if (err instanceof SyntaxError) {
    logger.warn({ path: req.originalUrl }, 'Malformed request body');
    res.status(400).json({
      error: {
        code: 'MALFORMED_JSON',
        message: 'Request body contains malformed JSON',
      },
    });
    return;
  }

  logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}