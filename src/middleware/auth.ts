import type { MiddlewareHandler } from 'hono';
import { config } from '../config';
import { AuthenticationError } from '../utils/errors';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always compares full length regardless of where mismatch occurs.
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a dummy comparison to maintain constant time
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if the provided key matches any configured API key.
 * Uses constant-time comparison to prevent timing attacks.
 */
function isValidApiKey(providedKey: string): boolean {
  let isValid = false;
  for (const configuredKey of config.apiKeys) {
    if (secureCompare(providedKey, configuredKey)) {
      isValid = true;
    }
  }
  return isValid;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Skip auth for health endpoints
  if (c.req.path === '/health' || c.req.path === '/ready') {
    return next();
  }

  let apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7);
    }
  }

  if (!apiKey) {
    throw new AuthenticationError('API key required');
  }

  if (!isValidApiKey(apiKey)) {
    throw new AuthenticationError('Invalid API key');
  }

  await next();
};
