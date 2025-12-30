import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[config.logLevel];
}

function formatMessage(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataStr}`;
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, data));
    }
  },

  info(message: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, data));
    }
  },

  warn(message: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, data));
    }
  },

  error(message: string, data?: Record<string, unknown>) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, data));
    }
  },
};
