import type { MiddlewareHandler } from 'hono';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { ErrorResponse } from '../types';

export const errorHandlerMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    const requestId = c.get('requestId') as string | undefined;

    if (err instanceof AppError) {
      logger.error(err.message, {
        requestId,
        code: err.code,
        statusCode: err.statusCode,
      });

      const response: ErrorResponse = {
        success: false,
        error: err.message,
        code: err.code,
        requestId,
      };

      return c.json(response, err.statusCode as 400 | 401 | 404 | 500 | 502 | 504);
    }

    logger.error('Unhandled error', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });

    const response: ErrorResponse = {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId,
    };

    return c.json(response, 500);
  }
};
