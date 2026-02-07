import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { createDevCommand } from './commands/dev.js';
import { createInitCommand } from './commands/init.js';
import { createAuthCommand } from './commands/auth.js';

const program = new Command();

program
  .name('buildover')
  .description('BuildOver CLI - AI-powered build overlay development')
  .version('0.0.1');

program.addCommand(createDevCommand());
program.addCommand(createInitCommand());
program.addCommand(createAuthCommand());

program.parse();
