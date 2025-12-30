import { Hono } from 'hono';

const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

health.get('/ready', (c) => {
  return c.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

export default health;
