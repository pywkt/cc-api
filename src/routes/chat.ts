import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { chatRequestSchema } from '../validators/chat';
import { invokeClaudeCli } from '../services/claude';
import { sessionStore } from '../services/session';
import type { ChatResponse } from '../types';

const chat = new Hono();

chat.post('/', zValidator('json', chatRequestSchema), async (c) => {
  const body = c.req.valid('json');
  const startTime = Date.now();

  const result = await invokeClaudeCli({
    prompt: body.prompt,
    sessionId: body.sessionId,
    workingDirectory: body.workingDirectory,
    model: body.model,
    systemPrompt: body.systemPrompt,
    allowedTools: body.allowedTools,
  });

  // Update session store
  const existingSession = await sessionStore.get(result.session_id);
  await sessionStore.set(result.session_id, {
    sessionId: result.session_id,
    createdAt: existingSession?.createdAt || new Date(),
    lastAccessedAt: new Date(),
    workingDirectory: body.workingDirectory || process.cwd(),
    messageCount: result.num_turns,
  });

  const response: ChatResponse = {
    success: true,
    sessionId: result.session_id,
    result: result.result,
    durationMs: Date.now() - startTime,
    usage: {
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      totalCostUsd: result.total_cost_usd,
    },
  };

  return c.json(response);
});

export default chat;
