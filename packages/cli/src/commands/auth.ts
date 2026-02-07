import { Command } from 'commander';
import chalk from 'chalk';

export function createAuthCommand(): Command {
  const command = new Command('auth');

  command
    .description('Setup Anthropic API key')
    .action(() => {
      console.log(chalk.bold('\nBuildOver API Key Setup\n'));

      const currentKey = process.env.ANTHROPIC_API_KEY;

      if (currentKey) {
        const masked = currentKey.slice(0, 8) + '...' + currentKey.slice(-4);
        console.log(chalk.green('✓ API key is set:'), chalk.dim(masked));
      } else {
        console.log(chalk.yellow('✗ No API key found'));
      }

      console.log(chalk.dim('\nTo set your API key:'));
      console.log(chalk.cyan('  export ANTHROPIC_API_KEY=your-api-key'));
      console.log(chalk.dim('\nOr add to your shell profile (~/.bashrc, ~/.zshrc):'));
      console.log(chalk.cyan('  echo "export ANTHROPIC_API_KEY=your-api-key" >> ~/.zshrc'));
      console.log(chalk.dim('\nGet your API key from: https://console.anthropic.com/'));
    });

  return command;
}
