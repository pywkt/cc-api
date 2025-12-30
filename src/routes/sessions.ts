import { Hono } from 'hono';
import { sessionStore } from '../services/session';
import { NotFoundError } from '../utils/errors';

const sessions = new Hono();

sessions.get('/', async (c) => {
  const allSessions = await sessionStore.list();
  return c.json({
    success: true,
    sessions: allSessions,
  });
});

sessions.get('/:id', async (c) => {
  const sessionId = c.req.param('id');
  const session = await sessionStore.get(sessionId);

  if (!session) {
    throw new NotFoundError(`Session ${sessionId} not found`);
  }

  return c.json({
    success: true,
    session,
  });
});

sessions.delete('/:id', async (c) => {
  const sessionId = c.req.param('id');
  const deleted = await sessionStore.delete(sessionId);

  if (!deleted) {
    throw new NotFoundError(`Session ${sessionId} not found`);
  }

  return c.json({
    success: true,
    message: `Session ${sessionId} deleted`,
  });
});

export default sessions;
