import { config } from '../config';
import { ClaudeError, TimeoutError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { ClaudeCliResponse, ClaudeStreamEvent, ClaudeUsage } from '../types';

export interface ClaudeInvokeOptions {
  prompt: string;
  sessionId?: string;
  workingDirectory?: string;
  model?: string;
  systemPrompt?: string;
  allowedTools?: string[];
}

export interface StreamChunk {
  type: 'text' | 'done';
  text?: string;
  sessionId?: string;
  usage?: ClaudeUsage;
  durationMs?: number;
}

export async function invokeClaudeCli(
  options: ClaudeInvokeOptions
): Promise<ClaudeCliResponse> {
  const args = buildCliArgs(options);
  const cwd = options.workingDirectory || process.cwd();

  logger.debug('Invoking Claude CLI', { args, cwd });

  const proc = Bun.spawn(['claude', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, config.claudeTimeout);

  try {
    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    if (timedOut) {
      throw new TimeoutError(
        `Claude CLI timed out after ${config.claudeTimeout}ms`
      );
    }

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (stderr) {
      logger.debug('Claude CLI stderr', { stderr });
    }

    if (exitCode !== 0) {
      throw new ClaudeError(
        `Claude CLI exited with code ${exitCode}`,
        stderr || stdout
      );
    }

    if (!stdout.trim()) {
      throw new ClaudeError('Claude CLI returned empty output');
    }

    let response: ClaudeCliResponse;
    try {
      response = JSON.parse(stdout) as ClaudeCliResponse;
    } catch {
      throw new ClaudeError('Failed to parse Claude CLI output', stdout);
    }

    if (response.is_error) {
      throw new ClaudeError(
        response.result || 'Claude returned an error',
        stdout
      );
    }

    logger.debug('Claude CLI response received', {
      sessionId: response.session_id,
      durationMs: response.duration_ms,
    });

    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function buildCliArgs(options: ClaudeInvokeOptions, streaming = false): string[] {
  const args = ['-p', options.prompt];

  if (streaming) {
    args.push('--output-format', 'stream-json', '--verbose', '--include-partial-messages');
  } else {
    args.push('--output-format', 'json');
  }

  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  // Use request model, fall back to config default
  const model = options.model || config.claudeModel;
  if (model) {
    args.push('--model', model);
  }

  if (options.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  // Enable specific tools (e.g., WebSearch)
  // Use request tools, fall back to config default
  const allowedTools = options.allowedTools || config.defaultAllowedTools;
  if (allowedTools && allowedTools.length > 0) {
    args.push('--allowedTools', allowedTools.join(','));
  }

  return args;
}

/**
 * Invoke Claude CLI with streaming output.
 * Yields text chunks as they arrive from the CLI.
 */
export async function* invokeClaudeCliStreaming(
  options: ClaudeInvokeOptions
): AsyncGenerator<StreamChunk> {
  const args = buildCliArgs(options, true);
  const cwd = options.workingDirectory || process.cwd();

  logger.debug('Invoking Claude CLI (streaming)', { args, cwd });

  const proc = Bun.spawn(['claude', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, config.claudeTimeout);

  try {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sessionId: string | undefined;
    let finalUsage: ClaudeUsage | undefined;
    let durationMs: number | undefined;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      if (timedOut) {
        throw new TimeoutError(
          `Claude CLI timed out after ${config.claudeTimeout}ms`
        );
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (NDJSON format)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as Record<string, unknown>;

          // Extract session ID from init event
          if (event.type === 'system' && event.subtype === 'init' && typeof event.session_id === 'string') {
            sessionId = event.session_id;
          }

          // Extract text deltas
          if (event.type === 'stream_event' && event.event && typeof event.event === 'object') {
            const streamEvent = event.event as Record<string, unknown>;
            if (
              streamEvent.type === 'content_block_delta' &&
              streamEvent.delta &&
              typeof streamEvent.delta === 'object'
            ) {
              const delta = streamEvent.delta as Record<string, unknown>;
              if (delta.type === 'text_delta' && typeof delta.text === 'string') {
                yield {
                  type: 'text',
                  text: delta.text,
                  sessionId,
                };
              }
            }
          }

          // Extract final result
          if (event.type === 'result') {
            finalUsage = event.usage as ClaudeUsage | undefined;
            durationMs = typeof event.duration_ms === 'number' ? event.duration_ms : undefined;
            sessionId = typeof event.session_id === 'string' ? event.session_id : sessionId;

            if (event.is_error) {
              const errorMsg = typeof event.result === 'string' ? event.result : 'Claude returned an error';
              throw new ClaudeError(errorMsg);
            }
          }
        } catch (parseError) {
          // Skip unparseable lines (might be partial JSON)
          if (parseError instanceof ClaudeError) throw parseError;
          logger.debug('Skipping unparseable stream line', { line });
        }
      }
    }

    clearTimeout(timeoutId);

    // Wait for process to exit
    const exitCode = await proc.exited;

    if (exitCode !== 0 && !timedOut) {
      const stderr = await new Response(proc.stderr).text();
      throw new ClaudeError(`Claude CLI exited with code ${exitCode}`, stderr);
    }

    // Yield final done chunk with usage info
    yield {
      type: 'done',
      sessionId,
      usage: finalUsage,
      durationMs,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
