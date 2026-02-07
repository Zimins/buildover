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
        '--allowedTools',
        'Read,Edit,Write,Glob,Grep',
      ],
      {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

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
    if (event.type === 'text') {
      const response: AgentResponse = {
        type: 'text',
        content: event.text || '',
      };
      this.emit('response', response);
    } else if (event.type === 'tool_use') {
      const response: AgentResponse = {
        type: 'tool_use',
        content: `Using tool: ${event.name}`,
        toolUse: {
          name: event.name,
          input: event.input || {},
        },
      };
      this.emit('response', response);

      if (event.name === 'Edit' || event.name === 'Write') {
        const change: FileChange = {
          path: event.input?.file_path || 'unknown',
          type: event.name === 'Write' ? 'added' : 'modified',
        };
        this.emit('file_change', change);
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
