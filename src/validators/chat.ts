import { z } from 'zod';
import { resolve, isAbsolute } from 'path';
import { existsSync } from 'fs';

// Validate working directory is a real, accessible path
const workingDirectorySchema = z
  .string()
  .transform((val) => {
    // Resolve to absolute path
    const resolved = isAbsolute(val) ? val : resolve(process.cwd(), val);
    return resolved;
  })
  .refine(
    (val) => {
      // Must exist and be accessible
      try {
        return existsSync(val);
      } catch {
        return false;
      }
    },
    { message: 'Working directory does not exist or is not accessible' }
  )
  .refine(
    (val) => {
      // Prevent obvious dangerous paths
      const dangerous = ['/etc', '/root', '/var', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc'];
      return !dangerous.some((d) => val === d || val.startsWith(d + '/'));
    },
    { message: 'Working directory is not allowed' }
  )
  .optional();

// Valid Claude Code tool names
const validTools = [
  'WebSearch',
  'WebFetch',
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'Task',
  'TodoWrite',
  'NotebookEdit',
];

const allowedToolsSchema = z
  .array(z.string())
  .refine(
    (tools) => tools.every((t) => validTools.includes(t) || t.startsWith('mcp__')),
    { message: `Invalid tool name. Valid tools: ${validTools.join(', ')}` }
  )
  .optional();

export const chatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(100000),
  sessionId: z.string().optional(),
  workingDirectory: workingDirectorySchema,
  model: z.string().optional(),
  systemPrompt: z.string().max(50000).optional(),
  allowedTools: allowedToolsSchema,
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
