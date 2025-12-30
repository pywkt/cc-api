import { Hono } from 'hono';
import {
  requestIdMiddleware,
  loggerMiddleware,
  errorHandlerMiddleware,
  authMiddleware,
} from './middleware';
import health from './routes/health';
import chat from './routes/chat';
import sessions from './routes/sessions';

const app = new Hono();

// Middleware (order matters)
app.use('*', requestIdMiddleware);
app.use('*', errorHandlerMiddleware);
app.use('*', loggerMiddleware);
app.use('*', authMiddleware);

// Routes
app.route('/', health);
app.route('/v1/chat', chat);
app.route('/v1/sessions', sessions);

export default app;
