import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { glob } from 'glob';
import chalk from 'chalk';
import type { AgentResponse, FileChange } from '../types.js';

const IGNORE = ['node_modules/**', '.git/**', 'dist/**', '.next/**'];

export class AnthropicAgent extends EventEmitter {
  private client: Anthropic;
  private history: Anthropic.MessageParam[] = [];
  private projectRoot: string;
  private abortController: AbortController | null = null;

  constructor(projectRoot: string, apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
    this.projectRoot = projectRoot;
  }

  async sendMessage(userMessage: string): Promise<void> {
    this.abortController = new AbortController();
    this.history.push({ role: 'user', content: userMessage });

    try {
      await this.runLoop();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(chalk.red('[Agent] Error:'), error.message);
        this.emit('response', { type: 'error', content: error.message } as AgentResponse);
      }
    }

    this.emit('response', { type: 'complete', content: 'Done' } as AgentResponse);
  }

  private async runLoop(): Promise<void> {
    while (true) {
      if (this.abortController?.signal.aborted) break;

      const stream = this.client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: this.buildSystemPrompt(),
        messages: this.history,
        tools: this.getTools(),
      } as any);

      stream.on('text', (text: string) => {
        this.emit('response', { type: 'text', content: text } as AgentResponse);
      });

      const message = await stream.finalMessage();

      this.history.push({ role: 'assistant', content: message.content });

      if (message.stop_reason !== 'tool_use') break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== 'tool_use') continue;

        const input = block.input as Record<string, any>;
        console.log(chalk.cyan(`[Agent] Tool: ${block.name}(${JSON.stringify(input).substring(0, 80)})`));

        this.emit('response', {
          type: 'tool_use',
          content: `Using ${block.name}`,
          toolUse: { name: block.name, input },
        } as AgentResponse);

        const result = await this.executeTool(block.name, input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }

      this.history.push({ role: 'user', content: toolResults });
    }
  }

  private async executeTool(name: string, input: Record<string, any>): Promise<string> {
    try {
      switch (name) {
        case 'read_file':   return await this.readFile(input);
        case 'write_file':  return await this.writeFile(input);
        case 'str_replace': return await this.strReplace(input);
        case 'glob_tool':   return await this.globTool(input);
        case 'grep_tool':   return await this.grepTool(input);
        default: return `Unknown tool: ${name}`;
      }
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.projectRoot, filePath);
  }

  private async readFile(input: Record<string, any>): Promise<string> {
    const abs = this.resolvePath(input.path);
    if (!existsSync(abs)) return `File not found: ${input.path}`;
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      const entries = await readdir(abs);
      return entries.join('\n');
    }
    return await readFile(abs, 'utf-8');
  }

  private async writeFile(input: Record<string, any>): Promise<string> {
    const abs = this.resolvePath(input.path);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, input.content, 'utf-8');
    this.emit('file_change', { path: abs, type: 'added' } as FileChange);
    return `Created ${input.path}`;
  }

  private async strReplace(input: Record<string, any>): Promise<string> {
    const abs = this.resolvePath(input.path);
    let content = await readFile(abs, 'utf-8');
    if (!content.includes(input.old_str)) {
      return `Error: old_str not found in ${input.path}`;
    }
    content = content.replace(input.old_str, input.new_str);
    await writeFile(abs, content, 'utf-8');
    this.emit('file_change', { path: abs, type: 'modified' } as FileChange);
    return `Edited ${input.path}`;
  }

  private async globTool(input: Record<string, any>): Promise<string> {
    const cwd = input.path ? this.resolvePath(input.path) : this.projectRoot;
    const files = await glob(input.pattern, { cwd, ignore: IGNORE });
    return files.length ? files.join('\n') : 'No files found';
  }

  private async grepTool(input: Record<string, any>): Promise<string> {
    const cwd = input.path ? this.resolvePath(input.path) : this.projectRoot;
    const files = await glob(input.file_pattern || '**/*', { cwd, ignore: IGNORE });
    const regex = new RegExp(input.pattern);
    const results: string[] = [];
    for (const file of files) {
      try {
        const content = await readFile(path.join(cwd, file), 'utf-8');
        content.split('\n').forEach((line, i) => {
          if (regex.test(line)) results.push(`${file}:${i + 1}: ${line.trim()}`);
        });
      } catch {}
    }
    return results.length ? results.slice(0, 100).join('\n') : 'No matches found';
  }

  private getTools(): Anthropic.Tool[] {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file or list a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute or relative path' },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Create or overwrite a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'str_replace',
        description: 'Edit a file by replacing an exact string with a new string',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            old_str: { type: 'string', description: 'Exact string to find and replace' },
            new_str: { type: 'string', description: 'Replacement string' },
          },
          required: ['path', 'old_str', 'new_str'],
        },
      },
      {
        name: 'glob_tool',
        description: 'Find files matching a glob pattern (e.g. "**/*.tsx", "src/**/*.ts")',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern' },
            path: { type: 'string', description: 'Subdirectory to search in (optional)' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'grep_tool',
        description: 'Search for a regex pattern in file contents',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex pattern' },
            path: { type: 'string', description: 'Directory to search in (optional)' },
            file_pattern: { type: 'string', description: 'File glob, e.g. "**/*.tsx" (optional)' },
          },
          required: ['pattern'],
        },
      },
    ];
  }

  private buildSystemPrompt(): string {
    return `You are BuildOver AI, an assistant that modifies web application source code in real-time.

Project directory: ${this.projectRoot}

Tools available:
- read_file: read a file or list directory contents
- write_file: create or overwrite a file
- str_replace: edit a file by replacing exact text
- glob_tool: find files by pattern
- grep_tool: search file contents

Always use absolute paths starting with "${this.projectRoot}".
Never modify .env, .git/, node_modules/, or dist/ directories.
After making changes, briefly describe what you changed.`;
  }

  stop(): void {
    this.abortController?.abort();
  }

  clearHistory(): void {
    this.history = [];
  }
}
