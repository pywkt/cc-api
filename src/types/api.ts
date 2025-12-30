export interface ChatRequest {
  prompt: string;
  sessionId?: string;
  workingDirectory?: string;
  model?: string;
  systemPrompt?: string;
  allowedTools?: string[];
}

export interface ChatResponse {
  success: true;
  sessionId: string;
  result: string;
  durationMs: number;
  usage?: UsageInfo;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  requestId?: string;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  workingDirectory: string;
  messageCount: number;
}
