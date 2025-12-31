# CC-API

A lightweight HTTP API server that wraps the Claude Code CLI, enabling remote machines on your local network to send prompts and receive responses from Claude.

## Features

- **Remote Claude Code Access**: Query Claude Code from any machine on your network
- **Session Persistence**: Continue conversations across multiple requests
- **Streaming Responses**: Real-time streaming for Ollama/OpenAI endpoints
- **API Key Authentication**: Secure access with configurable API keys
- **Model Selection**: Configure default model or override per-request
- **Ollama/OpenAI Compatible**: Works with Home Assistant and other LLM clients
- **Request Tracing**: Unique request IDs for debugging and logging
- **Graceful Error Handling**: Structured error responses with helpful messages
- **TypeScript**: Fully typed codebase with strict mode enabled

> **Note:** The Ollama-compatible endpoints (`/api/chat`, `/v1/chat/completions`) do not require authentication for Home Assistant compatibility. See [Security Considerations](#security-considerations) and [Home Assistant Integration](#home-assistant-integration) for details.

## Requirements

- [Bun](https://bun.sh/) v1.0.0 or later
- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- Claude Code subscription (Pro/Max) or API key configured

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
PORT=3000
HOST=0.0.0.0
API_KEYS=your-secure-api-key-here
CLAUDE_TIMEOUT_MS=120000
CLAUDE_MODEL=haiku
LOG_LEVEL=info
SESSION_STORAGE=memory
```

### 3. Start the Server

```bash
# Development mode (auto-reload)
bun run dev

# Production mode
bun run start
```

### 4. Test the Connection

```bash
# Health check (no auth required)
curl http://localhost:3000/health

# Send a prompt
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secure-api-key-here" \
  -d '{"prompt": "What is 2+2?"}'
```

## API Reference

### Authentication

All endpoints except `/health` and `/ready` require authentication via one of:

- **Header**: `X-API-Key: your-api-key`
- **Bearer Token**: `Authorization: Bearer your-api-key`

### Endpoints

#### Health Check

```
GET /health
```

Returns server health status. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Readiness Check

```
GET /ready
```

Returns server readiness status. No authentication required.

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Send Chat Message

```
POST /v1/chat
```

Send a prompt to Claude Code and receive a response.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The message to send to Claude (max 100,000 chars) |
| `sessionId` | string | No | Session ID to continue a previous conversation |
| `workingDirectory` | string | No | Working directory for Claude CLI |
| `model` | string | No | Model override (e.g., "haiku", "sonnet", "opus") |
| `systemPrompt` | string | No | Custom system prompt (max 50,000 chars) |
| `allowedTools` | string[] | No | Tools to enable (e.g., `["WebSearch", "Read"]`) |

**Available Tools:**

| Tool | Description |
|------|-------------|
| `WebSearch` | Search the web for current information |
| `WebFetch` | Fetch content from URLs |
| `Read` | Read files |
| `Write` | Write files |
| `Edit` | Edit files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |

**Example Request:**
```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "Explain recursion in simple terms",
    "model": "haiku"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "sessionId": "abc123-def456-ghi789",
  "result": "Recursion is when a function calls itself...",
  "durationMs": 1523,
  "usage": {
    "inputTokens": 45,
    "outputTokens": 230,
    "totalCostUsd": 0.00123
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Claude CLI timed out after 120000ms",
  "code": "TIMEOUT_ERROR",
  "requestId": "req-abc123"
}
```

#### Web Search Example

Enable web search to get current information:

```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "What are the latest news about AI?",
    "allowedTools": ["WebSearch"]
  }'
```

#### Continue a Conversation

To continue a previous conversation, include the `sessionId` from a previous response:

```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "Can you give me an example?",
    "sessionId": "abc123-def456-ghi789"
  }'
```

#### List Sessions

```
GET /v1/sessions
```

List all active sessions.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "abc123-def456-ghi789",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "lastAccessedAt": "2024-01-15T10:35:00.000Z",
      "workingDirectory": "/home/user/project",
      "messageCount": 5
    }
  ]
}
```

#### Get Session Details

```
GET /v1/sessions/:id
```

Get details for a specific session.

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "abc123-def456-ghi789",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastAccessedAt": "2024-01-15T10:35:00.000Z",
    "workingDirectory": "/home/user/project",
    "messageCount": 5
  }
}
```

#### Delete Session

```
DELETE /v1/sessions/:id
```

Delete a session from the store.

**Response:**
```json
{
  "success": true,
  "message": "Session abc123-def456-ghi789 deleted"
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host (use `0.0.0.0` for network access) |
| `API_KEYS` | (required) | Comma-separated list of valid API keys |
| `CLAUDE_TIMEOUT_MS` | `120000` | Timeout for Claude CLI calls (ms) |
| `CLAUDE_MODEL` | (none) | Default model: `haiku`, `sonnet`, `opus`, or full model name |
| `DEFAULT_ALLOWED_TOOLS` | (none) | Default tools for all requests (e.g., `WebSearch,WebFetch`) |
| `OLLAMA_API_ENABLED` | `true` | Enable Ollama-compatible endpoints for Home Assistant |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `SESSION_STORAGE` | `memory` | Session storage type: `memory` or `file` |
| `SESSION_STORAGE_PATH` | `./sessions` | Path for file-based session storage |

### Model Options

You can use model aliases or full model names:

| Alias | Description |
|-------|-------------|
| `haiku` | Claude Haiku - Fast and cost-effective |
| `sonnet` | Claude Sonnet - Balanced performance |
| `opus` | Claude Opus - Most capable |

Or use full model names like `claude-sonnet-4-20250514`.

## Project Structure

```
cc-api/
├── src/
│   ├── index.ts                 # Entry point, starts server
│   ├── app.ts                   # Hono app with middleware
│   ├── config/
│   │   └── index.ts             # Environment configuration
│   ├── middleware/
│   │   ├── index.ts             # Barrel export
│   │   ├── auth.ts              # API key authentication
│   │   ├── error-handler.ts     # Global error handling
│   │   ├── logger.ts            # Request/response logging
│   │   └── request-id.ts        # Request ID generation
│   ├── routes/
│   │   ├── index.ts             # Barrel export
│   │   ├── health.ts            # Health check endpoints
│   │   ├── chat.ts              # Chat endpoint
│   │   └── sessions.ts          # Session management
│   ├── services/
│   │   ├── index.ts             # Barrel export
│   │   ├── claude.ts            # Claude CLI wrapper
│   │   └── session.ts           # Session storage
│   ├── types/
│   │   ├── index.ts             # Barrel export
│   │   ├── api.ts               # API types
│   │   ├── claude.ts            # Claude CLI types
│   │   └── config.ts            # Config types
│   ├── validators/
│   │   ├── index.ts             # Barrel export
│   │   └── chat.ts              # Request validation
│   └── utils/
│       ├── index.ts             # Barrel export
│       ├── errors.ts            # Custom error classes
│       └── logger.ts            # Logging utility
├── package.json
├── tsconfig.json
├── .env.example
├── .env                         # Local config (gitignored)
├── .gitignore
├── CLAUDE.md                    # Claude Code context
└── README.md                    # This file
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_ERROR` | 401 | Invalid or missing API key |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Session not found |
| `CLAUDE_ERROR` | 502 | Claude CLI error |
| `TIMEOUT_ERROR` | 504 | Claude CLI timeout |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Usage Examples

### Python Client

```python
import requests

API_URL = "http://192.168.1.100:3000"
API_KEY = "your-api-key"

def ask_claude(prompt: str, session_id: str = None) -> dict:
    response = requests.post(
        f"{API_URL}/v1/chat",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY
        },
        json={
            "prompt": prompt,
            "sessionId": session_id
        }
    )
    return response.json()

# Single question
result = ask_claude("What is the capital of France?")
print(result["result"])

# Continue conversation
session_id = result["sessionId"]
follow_up = ask_claude("What about Germany?", session_id)
print(follow_up["result"])
```

### JavaScript/TypeScript Client

```typescript
const API_URL = "http://192.168.1.100:3000";
const API_KEY = "your-api-key";

async function askClaude(prompt: string, sessionId?: string) {
  const response = await fetch(`${API_URL}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({ prompt, sessionId }),
  });
  return response.json();
}

// Usage
const result = await askClaude("Explain quantum computing");
console.log(result.result);

// Continue conversation
const followUp = await askClaude("In simpler terms?", result.sessionId);
console.log(followUp.result);
```

### Shell Script

```bash
#!/bin/bash
API_URL="http://192.168.1.100:3000"
API_KEY="your-api-key"

ask_claude() {
  curl -s -X POST "$API_URL/v1/chat" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"prompt\": \"$1\"}" | jq -r '.result'
}

# Usage
ask_claude "What time is it in Tokyo?"
```

## Network Access

To access the server from other machines on your network:

1. Set `HOST=0.0.0.0` in your `.env` file
2. Find your server's IP address: `hostname -I` or `ip addr`
3. Ensure your firewall allows connections on the configured port
4. Use the server's IP address from other machines:

```bash
curl http://192.168.1.100:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"prompt": "Hello from another machine!"}'
```

## Security Considerations

### Built-in Protections

- **Constant-time API key comparison**: Prevents timing attacks on authentication
- **Working directory validation**: Blocks access to system directories (`/etc`, `/root`, `/var`, etc.) and validates paths exist
- **Request validation**: All inputs validated with Zod schemas
- **Structured error responses**: Errors don't leak internal details

### Best Practices

- **API Keys**: Use strong, unique API keys (32+ characters). Never commit `.env` to version control.
- **Network**: Only expose on trusted networks. Consider using a reverse proxy with HTTPS for production.
- **Firewall**: Restrict access to specific IPs if possible (`ufw allow from 192.168.1.0/24 to any port 3000`)
- **Rate Limiting**: Consider adding rate limiting for production use.
- **Monitoring**: Review logs regularly for suspicious activity.

## Development

### Type Checking

```bash
bun run typecheck
```

### Adding New Features

1. Add types to `src/types/`
2. Add validation schemas to `src/validators/`
3. Add business logic to `src/services/`
4. Add routes to `src/routes/`
5. Register routes in `src/app.ts`

## Running as a Service (Linux/systemd)

To run CC-API as a background service that starts automatically on boot:

### 1. Create a systemd service file

```bash
sudo nano /etc/systemd/system/cc-api.service
```

Add the following content (adjust paths and username for your system):

```ini
[Unit]
Description=CC-API - Claude Code HTTP API Server
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/cc-api
ExecStart=/path/to/bun run start
Restart=on-failure
RestartSec=5

# Environment
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Finding your paths:**
```bash
# Find bun path
which bun

# Find project path
pwd  # (run from cc-api directory)
```

### 2. Enable and start the service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable cc-api

# Start the service now
sudo systemctl start cc-api

# Check status
sudo systemctl status cc-api
```

### 3. Managing the service

| Command | Description |
|---------|-------------|
| `sudo systemctl start cc-api` | Start the service |
| `sudo systemctl stop cc-api` | Stop the service |
| `sudo systemctl restart cc-api` | Restart after config changes |
| `sudo systemctl status cc-api` | Check if running |
| `sudo journalctl -u cc-api -f` | View live logs |
| `sudo journalctl -u cc-api --since "1 hour ago"` | View recent logs |

## Home Assistant Integration

> **WARNING: Security Notice**
>
> The Ollama-compatible endpoints (`/api/chat`, `/v1/chat/completions`, etc.) do **NOT** require API key authentication. This is because Home Assistant's Ollama integration does not support sending API keys.
>
> **Only run this server on a trusted local network.** Anyone with network access to the server can send requests to Claude Code without authentication.
>
> To disable these unauthenticated endpoints, set `OLLAMA_API_ENABLED=false` in your `.env` file.

CC-API includes Ollama-compatible endpoints, allowing you to use Claude Code as a voice assistant in Home Assistant.

### Setup

1. **Configure CC-API** with web search enabled:

```bash
# .env
DEFAULT_ALLOWED_TOOLS=WebSearch,WebFetch
OLLAMA_API_ENABLED=true
```

2. **Start CC-API** on your server:

```bash
bun run start
```

3. **Add Ollama integration in Home Assistant:**
   - Go to Settings > Devices & Services > Add Integration
   - Search for "Ollama"
   - Enter the URL of your CC-API server (e.g., `http://192.168.1.100:3000`)
   - Select any model name (e.g., `claude-code`)

4. **Configure your Voice Assistant pipeline:**
   - Go to Settings > Voice Assistants
   - Edit your assistant
   - Set the Conversation Agent to your new Ollama integration

### Ollama-Compatible Endpoints

These endpoints mimic the Ollama API, allowing any Ollama-compatible client to use Claude Code.

#### POST /api/chat (Ollama Native)

Supports both streaming and non-streaming responses.

**Non-streaming request:**
```bash
curl http://localhost:3000/api/chat \
  -d '{
    "model": "claude-code",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "stream": false
  }'
```

**Response:**
```json
{
  "model": "claude-code",
  "created_at": "2024-01-15T10:30:00.000Z",
  "message": {
    "role": "assistant",
    "content": "The capital of France is Paris."
  },
  "done": true,
  "done_reason": "stop"
}
```

**Streaming request:**
```bash
curl -N http://localhost:3000/api/chat \
  -d '{
    "model": "claude-code",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "stream": true
  }'
```

**Streaming response (NDJSON):**
```json
{"model":"claude-code","created_at":"...","message":{"role":"assistant","content":"The"},"done":false}
{"model":"claude-code","created_at":"...","message":{"role":"assistant","content":" capital"},"done":false}
{"model":"claude-code","created_at":"...","message":{"role":"assistant","content":" of France"},"done":false}
{"model":"claude-code","created_at":"...","message":{"role":"assistant","content":" is Paris."},"done":false}
{"model":"claude-code","created_at":"...","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}
```

#### POST /v1/chat/completions (OpenAI Compatible)

Supports both streaming and non-streaming responses.

**Non-streaming request:**
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-code",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1705312200,
  "model": "claude-code",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  }
}
```

**Streaming request:**
```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-code",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

**Streaming response (SSE):**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1705312200,"model":"claude-code","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1705312200,"model":"claude-code","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1705312200,"model":"claude-code","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]
```

#### GET /api/tags (List Models)

```bash
curl http://localhost:3000/api/tags
```

**Response:**
```json
{
  "models": [
    {
      "name": "claude-code",
      "model": "claude-code:latest",
      "modified_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### GET /v1/models (OpenAI Compatible)

```bash
curl http://localhost:3000/v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-code",
      "object": "model",
      "created": 1705312200,
      "owned_by": "anthropic"
    }
  ]
}
```

### Features with Home Assistant

- **Web Search**: Ask about current events, weather, news
- **Conversation Memory**: Multi-turn conversations within a session
- **Home Control**: When exposed entities are configured in Home Assistant

### Example Conversation

> **You:** "What's the weather like in Tokyo today?"
>
> **Claude:** *searches the web and responds with current weather*

> **You:** "Turn on the living room lights"
>
> **Claude:** *controls exposed Home Assistant entities*

### Security Note

The Ollama-compatible endpoints (`/api/chat`, `/v1/chat/completions`) do not require API key authentication by default, as Home Assistant's Ollama integration doesn't support sending API keys. Only expose this server on a trusted local network.

To disable the Ollama API and require authentication on all endpoints:

```bash
OLLAMA_API_ENABLED=false
```

## Troubleshooting

### Claude CLI not found

Ensure Claude Code CLI is installed and in your PATH:

```bash
which claude
claude --version
```

### Authentication errors

Make sure Claude Code is authenticated:

```bash
claude --version  # Should not prompt for login
```

### Timeout errors

Increase the timeout in `.env`:

```bash
CLAUDE_TIMEOUT_MS=300000  # 5 minutes
```

### Connection refused from other machines

1. Check `HOST` is set to `0.0.0.0`
2. Check firewall: `sudo ufw allow 3000/tcp`
3. Verify the server is running: `curl http://localhost:3000/health`

## License

MIT
