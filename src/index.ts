import { config } from './config';
import { logger } from './utils/logger';
import app from './app';

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
});

logger.info(`Server started`, {
  host: config.host,
  port: config.port,
  url: `http://${config.host}:${config.port}`,
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  server.stop();
  process.exit(0);
});
