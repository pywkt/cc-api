import { config } from '../config';
import { ClaudeError, TimeoutError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { ClaudeCliResponse } from '../types';

export interface ClaudeInvokeOptions {
  prompt: string;
  sessionId?: string;
  workingDirectory?: string;
  model?: string;
  systemPrompt?: string;
  allowedTools?: string[];
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

function buildCliArgs(options: ClaudeInvokeOptions): string[] {
  const args = ['-p', options.prompt, '--output-format', 'json'];

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
  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push('--allowedTools', options.allowedTools.join(','));
  }

  return args;
}
