import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize BuildOver configuration')
    .action(() => {
      const configPath = join(process.cwd(), 'buildover.config.json');

      if (existsSync(configPath)) {
        console.log(chalk.yellow('buildover.config.json already exists'));
        return;
      }

      const defaultConfig = {
        port: 4100,
        targetUrl: 'http://localhost:3000',
        autoReload: true,
      };

      try {
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(chalk.green('✓ Created buildover.config.json'));
        console.log(chalk.dim('\nNext steps:'));
        console.log(chalk.dim('1. Set ANTHROPIC_API_KEY environment variable'));
        console.log(chalk.dim('2. Run: buildover dev'));
      } catch (error) {
        console.error(chalk.red('Failed to create config:'), error);
        process.exit(1);
      }
    });

  return command;
}
