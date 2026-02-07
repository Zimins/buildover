import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import { AgentResponse, FileChange } from '../types.js';
import chalk from 'chalk';

function resolveClaudePath(): string {
  // 1. Check ~/.claude/local/claude (default install location)
  const localPath = join(homedir(), '.claude', 'local', 'claude');
  if (existsSync(localPath)) return localPath;

  // 2. Try to find via shell (resolves aliases, nvm paths, etc.)
  try {
    const resolved = execSync('which claude', { encoding: 'utf-8' }).trim();
    if (resolved) return resolved;
  } catch {}

  // 3. Fallback to bare command name
  return 'claude';
}

export class ClaudeAgent extends EventEmitter {
  private projectRoot: string;
  private currentProcess: ReturnType<typeof spawn> | null = null;
  private static claudePath: string = resolveClaudePath();

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
  }

  async sendMessage(message: string): Promise<void> {
    if (this.currentProcess) {
      console.warn(chalk.yellow('[Agent] Already processing a message, ignoring'));
      return;
    }

    const args = [
      '-p',
      message,
      '--output-format',
      'stream-json',
      '--verbose',
      '--allowedTools',
      'Read,Edit,Write,Glob,Grep',
      '--permission-mode',
      'bypassPermissions',
    ];

    console.log(chalk.blue(`[Agent] Starting Claude CLI: ${ClaudeAgent.claudePath}`));
    console.log(chalk.blue(`[Agent] CWD: ${this.projectRoot}`));
    console.log(chalk.blue(`[Agent] Args: ${args.join(' ')}`));
    console.log(chalk.blue(`[Agent] Prompt: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`));

    this.currentProcess = spawn(
      ClaudeAgent.claudePath,
      args,
      {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const pid = this.currentProcess.pid;
    console.log(chalk.blue(`[Agent] Process spawned, PID: ${pid}`));

    // Close stdin immediately - claude CLI waits for stdin EOF before producing output
    this.currentProcess.stdin?.end();
    console.log(chalk.blue('[Agent] stdin closed (EOF sent)'));

    let buffer = '';
    let chunkCount = 0;
    let eventCount = 0;

    this.currentProcess.stdout?.on('data', (chunk) => {
      chunkCount++;
      const chunkStr = chunk.toString();
      console.log(chalk.gray(`[Agent] stdout chunk #${chunkCount} (${chunkStr.length} bytes)`));

      buffer += chunkStr;
      const lines = buffer.split('\n');

      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          eventCount++;
          console.log(chalk.cyan(`[Agent] Event #${eventCount}: type=${parsed.type}${parsed.type === 'assistant' ? `, blocks=${parsed.message?.content?.length || 0}` : ''}${parsed.type === 'result' ? `, is_error=${parsed.is_error}` : ''}`));
          this.handleStreamEvent(parsed);
        } catch (error) {
          console.error(chalk.red(`[Agent] Failed to parse JSON:`), line.substring(0, 200));
        }
      }
    });

    this.currentProcess.stderr?.on('data', (chunk) => {
      const errStr = chunk.toString().trim();
      console.error(chalk.red(`[Agent] stderr: ${errStr}`));
      this.emit('error', errStr);
    });

    this.currentProcess.on('close', (code) => {
      console.log(chalk.green(`[Agent] Process exited, code=${code}, events=${eventCount}, chunks=${chunkCount}`));
      this.currentProcess = null;

      const response: AgentResponse = {
        type: 'complete',
        content: 'Agent execution completed',
      };
      this.emit('response', response);
    });

    this.currentProcess.on('error', (error) => {
      console.error(chalk.red(`[Agent] Failed to start process:`), error.message);
      this.currentProcess = null;

      const response: AgentResponse = {
        type: 'error',
        content: error.message,
      };
      this.emit('response', response);
    });
  }

  private handleStreamEvent(event: any): void {
    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'text') {
          console.log(chalk.cyan(`[Agent]   → text block (${(block.text || '').length} chars)`));
          const response: AgentResponse = {
            type: 'text',
            content: block.text || '',
          };
          this.emit('response', response);
        } else if (block.type === 'tool_use') {
          console.log(chalk.cyan(`[Agent]   → tool_use: ${block.name}(${JSON.stringify(block.input || {}).substring(0, 100)})`));
          const response: AgentResponse = {
            type: 'tool_use',
            content: `Using tool: ${block.name}`,
            toolUse: {
              name: block.name,
              input: block.input || {},
            },
          };
          this.emit('response', response);

          if (block.name === 'Edit' || block.name === 'Write') {
            const change: FileChange = {
              path: block.input?.file_path || 'unknown',
              type: block.name === 'Write' ? 'added' : 'modified',
            };
            this.emit('file_change', change);
          }
        } else {
          console.log(chalk.gray(`[Agent]   → unknown block type: ${block.type}`));
        }
      }
    } else if (event.type === 'result') {
      console.log(chalk.cyan(`[Agent]   → result: is_error=${event.is_error}, result="${(event.result || '').substring(0, 100)}"`));
      if (event.is_error) {
        const response: AgentResponse = {
          type: 'error',
          content: event.result || 'Agent execution failed',
        };
        this.emit('response', response);
      }
    } else if (event.type === 'system') {
      console.log(chalk.gray(`[Agent]   → system event`));
    }
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }
}
