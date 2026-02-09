import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { BuildOverConfig } from 'buildover-server';

export function defineConfig(config: BuildOverConfig): BuildOverConfig {
  return config;
}

export async function loadConfig(cwd: string = process.cwd()): Promise<BuildOverConfig | null> {
  const configPath = join(cwd, 'buildover.config.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}
