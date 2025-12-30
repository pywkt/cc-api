export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ClaudeError extends AppError {
  constructor(
    message: string,
    public cliOutput?: string
  ) {
    super(message, 502, 'CLAUDE_ERROR');
    this.name = 'ClaudeError';
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Claude CLI timed out') {
    super(message, 504, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
