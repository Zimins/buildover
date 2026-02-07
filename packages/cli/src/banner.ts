import chalk from 'chalk';

export interface BannerOptions {
  framework?: string;
  targetUrl?: string;
  serverUrl: string;
}

export function printBanner(options: BannerOptions): void {
  const { framework, targetUrl, serverUrl } = options;

  console.log('\n' + chalk.cyan('╔══════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold('            BuildOver Dev Server              ') + chalk.cyan('║'));
  console.log(chalk.cyan('╠══════════════════════════════════════════════╣'));

  if (framework) {
    console.log(chalk.cyan('║') + `  감지된 프레임워크:  ${chalk.green(framework)}`.padEnd(62) + chalk.cyan('║'));
  }

  if (targetUrl) {
    console.log(chalk.cyan('║') + `  원본 앱:           ${chalk.blue(targetUrl)}`.padEnd(62) + chalk.cyan('║'));
  }

  console.log(chalk.cyan('║') + `  ➜ ${chalk.bold.green(serverUrl)}`.padEnd(62) + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════╝') + '\n');
}
