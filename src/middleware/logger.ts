import type { MiddlewareHandler } from 'hono';
import { logger } from '../utils/logger';

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId') as string | undefined;

  logger.info(`--> ${method} ${path}`, { requestId });

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info(`<-- ${method} ${path} ${status} ${duration}ms`, { requestId });
};
