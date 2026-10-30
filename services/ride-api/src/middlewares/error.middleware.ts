import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue ? issue.path.join('.') : '';
    const reason = issue ? `${field ? `${field}: ` : ''}${issue.message}` : 'Invalid request';
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: reason, details: err.flatten() },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
