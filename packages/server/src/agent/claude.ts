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
      console.warn(chalk.yellow('Agent is already processing a message'));
      return;
    }

    console.log(chalk.blue(`Starting Claude agent (${ClaudeAgent.claudePath})...`));

    this.currentProcess = spawn(
      ClaudeAgent.claudePath,
      [
        '-p',
        message,
        '--output-format',
        'stream-json',
        '--verbose',
        '--allowedTools',
        'Read,Edit,Write,Glob,Grep',
        '--permission-mode',
        'bypassPermissions',
      ],
      {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Close stdin immediately - claude CLI waits for stdin EOF before producing output
    this.currentProcess.stdin?.end();

    let buffer = '';

    this.currentProcess.stdout?.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          this.handleStreamEvent(parsed);
        } catch (error) {
          console.error(chalk.red('Failed to parse stream event:'), line);
        }
      }
    });

    this.currentProcess.stderr?.on('data', (chunk) => {
      console.error(chalk.red('Agent error:'), chunk.toString());
      this.emit('error', chunk.toString());
    });

    this.currentProcess.on('close', (code) => {
      console.log(chalk.green(`Agent process exited with code ${code}`));
      this.currentProcess = null;

      const response: AgentResponse = {
        type: 'complete',
        content: 'Agent execution completed',
      };
      this.emit('response', response);
    });

    this.currentProcess.on('error', (error) => {
      console.error(chalk.red('Failed to start agent:'), error);
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
          const response: AgentResponse = {
            type: 'text',
            content: block.text || '',
          };
          this.emit('response', response);
        } else if (block.type === 'tool_use') {
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
        }
      }
    } else if (event.type === 'result') {
      if (event.is_error) {
        const response: AgentResponse = {
          type: 'error',
          content: event.result || 'Agent execution failed',
        };
        this.emit('response', response);
      }
    }
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }
}
