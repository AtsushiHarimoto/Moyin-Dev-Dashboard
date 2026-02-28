import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HERMIT_PURPLE_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'hermit-purple');

export async function createHermitPurpleClient(): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.env.HERMIT_PYTHON || 'python3',
    args: ['-m', 'src.mcp_server'],
    cwd: HERMIT_PURPLE_DIR,
    env: {
      ...process.env,
      PYTHONPATH: HERMIT_PURPLE_DIR,
    },
  });

  const client = new Client({
    name: 'skills-switch-gui',
    version: '1.0.0',
  });

  await client.connect(transport);
  return { client, transport };
}

// ========== Shared client for batch reuse ==========

let sharedClient: Client | null = null;
let sharedTransport: StdioClientTransport | null = null;

export async function acquireSharedClient(): Promise<{ client: Client; transport: StdioClientTransport }> {
  if (sharedClient && sharedTransport) {
    return { client: sharedClient, transport: sharedTransport };
  }
  const conn = await createHermitPurpleClient();
  sharedClient = conn.client;
  sharedTransport = conn.transport;
  return conn;
}

export async function destroySharedClient(): Promise<void> {
  if (sharedTransport) {
    try { await sharedTransport.close(); } catch { /* ignore */ }
    sharedTransport = null;
  }
  sharedClient = null;
}

export function killSharedTransport(): void {
  if (sharedTransport) {
    try { sharedTransport.close(); } catch { /* ignore */ }
    sharedTransport = null;
  }
  sharedClient = null;
}

/**
 * Call an MCP tool with optional timeout.
 *
 * Timeout behaviour: the MCP SDK uses `setTimeout` + sends a
 * `notifications/cancelled` JSON-RPC message to the subprocess, then
 * rejects the promise.  However the subprocess may ignore the
 * cancellation and keep running (especially during long AI API calls).
 * The protocol-level state (message IDs, response handlers) is cleaned
 * up correctly so subsequent calls on the same client *usually* work,
 * but if the subprocess is truly stuck the stdio pipe may stall.
 *
 * TODO(I5): For long-running batch flows (keyword-presets, batch
 * analysis) consider recreating the MCP client after a timeout error
 * to guarantee a clean subprocess.  A full fix would require killing
 * the child process (transport.close()) and reconnecting, which the
 * callers in keyword-presets.ts / runner.ts would need to coordinate.
 */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  timeoutMs?: number,
): Promise<string> {
  const options = timeoutMs ? { timeout: timeoutMs } : undefined;
  const result = await client.callTool({ name, arguments: args }, undefined, options);
  const content = result.content as Array<{ type: string; text: string }> | undefined;
  if (content && content.length > 0 && content[0].type === 'text') {
    return content[0].text;
  }
  if (!content || content.length === 0) {
    throw new Error(`MCP tool "${name}" returned no content`);
  }
  return JSON.stringify(content);
}

export async function readResource(client: Client, uri: string): Promise<string> {
  const result = await client.readResource({ uri });
  const content = result.contents;
  if (content && content.length > 0) {
    const first = content[0];
    if ('text' in first) return first.text as string;
  }
  return '';
}
