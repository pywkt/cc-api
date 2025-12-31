import { Hono } from 'hono';
import { stream, streamSSE } from 'hono/streaming';
import { invokeClaudeCli, invokeClaudeCliStreaming } from '../services/claude';
import { logger } from '../utils/logger';
import type {
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
} from '../types';

const ollama = new Hono();

/**
 * Convert Ollama messages array to a single prompt string.
 * Preserves conversation context by formatting messages.
 */
function messagesToPrompt(messages: OllamaMessage[]): {
  prompt: string;
  systemPrompt?: string;
} {
  let systemPrompt: string | undefined;
  const conversationParts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = msg.content;
    } else if (msg.role === 'user') {
      conversationParts.push(`User: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      conversationParts.push(`Assistant: ${msg.content}`);
    }
  }

  // If there's only one user message and no conversation history, just use the content directly
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  if (userMessages.length === 1 && assistantMessages.length === 0) {
    return {
      prompt: userMessages[0].content,
      systemPrompt,
    };
  }

  // Otherwise, format as a conversation and ask to continue
  return {
    prompt: conversationParts.join('\n\n') + '\n\nAssistant:',
    systemPrompt,
  };
}

/**
 * Ollama-compatible /api/chat endpoint
 * This allows Home Assistant's Ollama integration to work with Claude Code
 */
ollama.post('/api/chat', async (c) => {
  const body = await c.req.json<OllamaChatRequest>();
  const modelName = body.model || 'claude-code';

  logger.debug('Ollama /api/chat request', {
    model: modelName,
    messageCount: body.messages?.length,
    stream: body.stream,
  });

  const { prompt, systemPrompt } = messagesToPrompt(body.messages || []);
  const startTime = Date.now();

  // Handle streaming request (Ollama uses raw NDJSON, not SSE)
  if (body.stream === true) {
    return stream(c, async (s) => {
      try {
        for await (const chunk of invokeClaudeCliStreaming({ prompt, systemPrompt })) {
          if (chunk.type === 'text' && chunk.text) {
            const response: OllamaChatResponse = {
              model: modelName,
              created_at: new Date().toISOString(),
              message: {
                role: 'assistant',
                content: chunk.text,
              },
              done: false,
            };
            // Ollama uses NDJSON format (newline-delimited JSON)
            await s.write(JSON.stringify(response) + '\n');
          } else if (chunk.type === 'done') {
            const response: OllamaChatResponse = {
              model: modelName,
              created_at: new Date().toISOString(),
              message: {
                role: 'assistant',
                content: '',
              },
              done: true,
              done_reason: 'stop',
              total_duration: (chunk.durationMs || (Date.now() - startTime)) * 1_000_000,
              prompt_eval_count: chunk.usage?.input_tokens,
              eval_count: chunk.usage?.output_tokens,
            };
            await s.write(JSON.stringify(response) + '\n');
          }
        }
      } catch (error) {
        logger.error('Ollama /api/chat streaming error', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Send error as final message
        const errorResponse: OllamaChatResponse = {
          model: modelName,
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
          done: true,
          done_reason: 'stop',
        };
        await s.write(JSON.stringify(errorResponse) + '\n');
      }
    });
  }

  // Non-streaming request
  try {
    const result = await invokeClaudeCli({
      prompt,
      systemPrompt,
    });

    const response: OllamaChatResponse = {
      model: modelName,
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: result.result,
      },
      done: true,
      done_reason: 'stop',
      total_duration: (Date.now() - startTime) * 1_000_000,
      prompt_eval_count: result.usage?.input_tokens,
      eval_count: result.usage?.output_tokens,
    };

    return c.json(response);
  } catch (error) {
    logger.error('Ollama /api/chat error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

/**
 * OpenAI-compatible /v1/chat/completions endpoint
 * Ollama also supports this format
 */
ollama.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json<OpenAIChatRequest>();
  const modelName = body.model || 'claude-code';
  const completionId = `chatcmpl-${crypto.randomUUID()}`;

  logger.debug('OpenAI /v1/chat/completions request', {
    model: modelName,
    messageCount: body.messages?.length,
    stream: body.stream,
  });

  const { prompt, systemPrompt } = messagesToPrompt(
    body.messages as OllamaMessage[]
  );

  // Handle streaming request (OpenAI SSE format)
  if (body.stream === true) {
    return streamSSE(c, async (stream) => {
      try {
        let promptTokens = 0;
        let completionTokens = 0;

        for await (const chunk of invokeClaudeCliStreaming({ prompt, systemPrompt })) {
          if (chunk.type === 'text' && chunk.text) {
            const response = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelName,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: chunk.text,
                  },
                  finish_reason: null,
                },
              ],
            };
            await stream.writeSSE({ data: JSON.stringify(response) });
          } else if (chunk.type === 'done') {
            promptTokens = chunk.usage?.input_tokens || 0;
            completionTokens = chunk.usage?.output_tokens || 0;

            // Send final chunk with finish_reason
            const finalResponse = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelName,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
              },
            };
            await stream.writeSSE({ data: JSON.stringify(finalResponse) });
            await stream.writeSSE({ data: '[DONE]' });
          }
        }
      } catch (error) {
        logger.error('OpenAI /v1/chat/completions streaming error', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Send error in OpenAI format
        const errorResponse = {
          error: {
            message: error instanceof Error ? error.message : String(error),
            type: 'server_error',
          },
        };
        await stream.writeSSE({ data: JSON.stringify(errorResponse) });
      }
    });
  }

  // Non-streaming request
  try {
    const result = await invokeClaudeCli({
      prompt,
      systemPrompt,
    });

    const response: OpenAIChatResponse = {
      id: `chatcmpl-${result.session_id || crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.result,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.usage?.input_tokens || 0,
        completion_tokens: result.usage?.output_tokens || 0,
        total_tokens:
          (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
      },
    };

    return c.json(response);
  } catch (error) {
    logger.error('OpenAI /v1/chat/completions error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

/**
 * GET /api/tags - List available models (required by some clients)
 */
ollama.get('/api/tags', (c) => {
  return c.json({
    models: [
      {
        name: 'claude-code',
        model: 'claude-code:latest',
        modified_at: new Date().toISOString(),
        size: 0,
        digest: 'claude-code',
        details: {
          parent_model: '',
          format: 'claude',
          family: 'claude',
          families: ['claude'],
          parameter_size: 'unknown',
          quantization_level: 'none',
        },
      },
    ],
  });
});

/**
 * GET /v1/models - OpenAI-compatible model list
 */
ollama.get('/v1/models', (c) => {
  return c.json({
    object: 'list',
    data: [
      {
        id: 'claude-code',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
    ],
  });
});

/**
 * GET / - Health check (some clients check this)
 */
ollama.get('/', (c) => {
  return c.text('Ollama is running');
});

export default ollama;
