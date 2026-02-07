import { Command } from 'commander';
import chalk from 'chalk';
import { BuildOverServer, detectPort, detectFramework } from '@buildover/server';
import { loadConfig } from '../config.js';
import { printBanner } from '../banner.js';

export function createDevCommand(): Command {
  const command = new Command('dev');

  command
    .description('Start BuildOver development server')
    .option('-p, --port <port>', 'BuildOver server port', '4100')
    .option('-t, --target <url>', 'Target development server URL')
    .option('-s, --serve', 'Start the target dev server automatically', false)
    .option('-o, --open', 'Open browser automatically', false)
    .action(async (options) => {
      try {
        // Load config
        const config = await loadConfig();

        // Resolve API key (optional - proxy works without it, AI chat requires it)
        const apiKey = process.env.ANTHROPIC_API_KEY;
        const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
        if (!apiKey && !oauthToken) {
          console.warn(chalk.yellow('⚠ No authentication configured. Proxy + widget will work, but AI chat is disabled.'));
          console.warn(chalk.yellow('  Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in .env file\n'));
        }

        // Detect framework
        const frameworkInfo = await detectFramework(process.cwd());
        const detectedFramework = frameworkInfo ? frameworkInfo.name : 'Unknown';

        // Detect or use target port
        let targetUrl = options.target;
        if (!targetUrl) {
          const detectedPort = await detectPort(process.cwd());
          if (detectedPort) {
            targetUrl = `http://localhost:${detectedPort}`;
          } else {
            targetUrl = 'http://localhost:3000'; // Default fallback
          }
        } else if (/^\d+$/.test(targetUrl)) {
          targetUrl = `http://localhost:${targetUrl}`;
        } else if (!targetUrl.startsWith('http')) {
          targetUrl = `http://${targetUrl}`;
        }

        // Parse server port
        const serverPort = parseInt(options.port, 10);

        // Create and start server
        const server = new BuildOverServer({
          port: serverPort,
          targetUrl,
          apiKey,
          projectRoot: process.cwd(),
        });

        await server.start();

        // Print startup banner
        printBanner({
          framework: detectedFramework,
          targetUrl,
          serverUrl: `http://localhost:${serverPort}`,
        });

        console.log(chalk.dim('Press Ctrl+C to stop\n'));

        // Handle graceful shutdown
        const shutdown = async () => {
          console.log('\n' + chalk.yellow('Shutting down BuildOver server...'));
          await server.stop();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (error) {
        console.error(chalk.red('Failed to start dev server:'), error);
        process.exit(1);
      }
    });

  return command;
}
