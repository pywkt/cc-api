import type { MiddlewareHandler } from 'hono';

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
};
