export interface ClaudeCliResponse {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: ClaudeUsage;
  modelUsage: Record<string, ModelUsage>;
  permission_denials: string[];
  uuid: string;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  server_tool_use: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}

// Streaming types for --output-format stream-json --include-partial-messages
export interface ClaudeStreamInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
  cwd: string;
}

export interface ClaudeStreamDelta {
  type: 'stream_event';
  event: {
    type: 'content_block_delta';
    index: number;
    delta: {
      type: 'text_delta';
      text: string;
    };
  };
  session_id: string;
}

export interface ClaudeStreamMessageStop {
  type: 'stream_event';
  event: {
    type: 'message_stop';
  };
  session_id: string;
}

export interface ClaudeStreamResult {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  duration_ms: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: ClaudeUsage;
}

export type ClaudeStreamEvent =
  | ClaudeStreamInit
  | ClaudeStreamDelta
  | ClaudeStreamMessageStop
  | ClaudeStreamResult
  | { type: string; [key: string]: unknown };
