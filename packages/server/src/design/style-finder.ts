import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';

export interface StyleChangeRequest {
  classes: string[];
  id: string;
  property: string;       // CSS kebab-case: 'font-size', 'color', etc.
  oldValue: string;       // '24px', '#111827', etc.
  newValue: string;       // '20px', '#ff0000', etc.
  projectRoot: string;
}

export interface StyleChangeResult {
  success: boolean;
  filePath?: string;
  strategy?: string;
  error?: string;
}

// Tailwind size maps
const TW_FONT_SIZE: Record<string, string> = {
  '12px': 'text-xs', '14px': 'text-sm', '16px': 'text-base',
  '18px': 'text-[28px]', '20px': 'text-xl', '24px': 'text-2xl',
  '30px': 'text-3xl', '36px': 'text-4xl', '48px': 'text-5xl',
  '60px': 'text-6xl', '72px': 'text-7xl', '80px': 'text-8xl',
  '96px': 'text-9xl',
};
const TW_FONT_SIZE_REV: Record<string, string> = {};
for (const [px, tw] of Object.entries(TW_FONT_SIZE)) TW_FONT_SIZE_REV[tw] = px;

const TW_FONT_WEIGHT: Record<string, string> = {
  '100': 'font-thin', '200': 'font-extralight', '300': 'font-light',
  '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold',
  '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black',
};

const TW_LETTER_SPACING: Record<string, string> = {
  '-0.05em': 'tracking-tighter', '-0.025em': 'tracking-tight',
  '0em': 'tracking-normal', '0.025em': 'tracking-wide',
  '0.05em': 'tracking-wider', '0.1em': 'tracking-widest',
};

const TW_LINE_HEIGHT: Record<string, string> = {
  '1': 'leading-none', '1.25': 'leading-tight', '1.375': 'leading-snug',
  '1.5': 'leading-normal', '1.625': 'leading-relaxed', '2': 'leading-loose',
};

function grepFiles(pattern: string, projectRoot: string, glob: string): string[] {
  try {
    const result = execSync(
      `grep -rl --include="${glob}" ${JSON.stringify(pattern)} .`,
      { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function grepFilesMultiGlob(pattern: string, projectRoot: string, globs: string[]): string[] {
  const results: string[] = [];
  for (const g of globs) {
    results.push(...grepFiles(pattern, projectRoot, g));
  }
  return [...new Set(results)];
}

export class StyleFinder {
  async findAndReplace(req: StyleChangeRequest): Promise<StyleChangeResult> {
    const strategies = [
      () => this.tryCssClassReplace(req),
      () => this.tryTailwindReplace(req),
      () => this.tryIdBasedReplace(req),
      () => this.tryInlineStyleReplace(req),
    ];

    for (const strategy of strategies) {
      const result = await strategy();
      if (result.success) {
        console.log(chalk.green(`[StyleFinder] ${result.strategy}: ${result.filePath}`));
        return result;
      }
    }

    return { success: false, error: 'Could not find style definition in source files' };
  }

  private async tryCssClassReplace(req: StyleChangeRequest): Promise<StyleChangeResult> {
    const { classes, property, oldValue, newValue, projectRoot } = req;

    for (const cls of classes) {
      // Search for .className in CSS/SCSS files
      const files = grepFilesMultiGlob(`.${cls}`, projectRoot, ['*.css', '*.scss']);

      for (const file of files) {
        const filePath = file.startsWith('./') ? file.slice(2) : file;
        const fullPath = `${projectRoot}/${filePath}`;
        try {
          const content = readFileSync(fullPath, 'utf-8');

          // Find the class block and property within it
          // Match: .className { ... property: oldValue ... }
          const classPattern = new RegExp(
            `(\\.${escapeRegex(cls)}\\s*\\{[^}]*?)${escapeRegex(property)}\\s*:\\s*${escapeRegex(oldValue)}`,
            's'
          );

          if (classPattern.test(content)) {
            const newContent = content.replace(
              classPattern,
              `$1${property}: ${newValue}`
            );
            writeFileSync(fullPath, newContent, 'utf-8');
            return { success: true, filePath, strategy: 'css-class' };
          }
        } catch {
          continue;
        }
      }
    }

    return { success: false };
  }

  private async tryTailwindReplace(req: StyleChangeRequest): Promise<StyleChangeResult> {
    const { classes, property, newValue, projectRoot } = req;

    // Identify which existing class corresponds to the property
    let oldTwClass: string | undefined;
    let newTwClass: string | undefined;

    if (property === 'font-size') {
      // Find existing text-* class
      oldTwClass = classes.find(c => c.startsWith('text-') && (TW_FONT_SIZE_REV[c] || c.match(/^text-\[.+\]$/)));
      newTwClass = TW_FONT_SIZE[newValue] || `text-[${newValue}]`;
    } else if (property === 'font-weight') {
      const oldWeightClasses = Object.values(TW_FONT_WEIGHT);
      oldTwClass = classes.find(c => oldWeightClasses.includes(c));
      newTwClass = TW_FONT_WEIGHT[newValue] || `font-[${newValue}]`;
    } else if (property === 'letter-spacing') {
      const oldTrackingClasses = Object.values(TW_LETTER_SPACING);
      oldTwClass = classes.find(c => c.startsWith('tracking-'));
      newTwClass = TW_LETTER_SPACING[newValue] || `tracking-[${newValue}]`;
    } else if (property === 'line-height') {
      oldTwClass = classes.find(c => c.startsWith('leading-'));
      newTwClass = TW_LINE_HEIGHT[newValue] || `leading-[${newValue}]`;
    } else if (property === 'color') {
      // Color is complex — try text-[#hex] arbitrary syntax
      oldTwClass = classes.find(c => c.startsWith('text-') && !TW_FONT_SIZE_REV[c] && !c.startsWith('text-[') || c.match(/^text-\[#/));
      newTwClass = `text-[${newValue}]`;
    }

    if (!oldTwClass || !newTwClass || oldTwClass === newTwClass) {
      return { success: false };
    }

    // Search source files for the old Tailwind class
    const files = grepFilesMultiGlob(oldTwClass, projectRoot, ['*.tsx', '*.jsx', '*.ts', '*.js', '*.html', '*.vue']);

    for (const file of files) {
      const filePath = file.startsWith('./') ? file.slice(2) : file;
      // Skip node_modules and build output
      if (filePath.includes('node_modules') || filePath.includes('/dist/') || filePath.includes('/.next/')) continue;

      const fullPath = `${projectRoot}/${filePath}`;
      try {
        const content = readFileSync(fullPath, 'utf-8');

        // Replace the class within a className/class attribute context
        // Match: oldTwClass surrounded by word boundaries (space, quote, backtick)
        const pattern = new RegExp(`(?<=["'\`\\s])${escapeRegex(oldTwClass)}(?=["'\`\\s])`, 'g');

        if (pattern.test(content)) {
          const newContent = content.replace(pattern, newTwClass);
          writeFileSync(fullPath, newContent, 'utf-8');
          return { success: true, filePath, strategy: 'tailwind' };
        }
      } catch {
        continue;
      }
    }

    return { success: false };
  }

  private async tryIdBasedReplace(req: StyleChangeRequest): Promise<StyleChangeResult> {
    const { id, property, oldValue, newValue, projectRoot } = req;
    if (!id) return { success: false };

    const files = grepFilesMultiGlob(`#${id}`, projectRoot, ['*.css', '*.scss']);

    for (const file of files) {
      const filePath = file.startsWith('./') ? file.slice(2) : file;
      const fullPath = `${projectRoot}/${filePath}`;
      try {
        const content = readFileSync(fullPath, 'utf-8');

        const idPattern = new RegExp(
          `(#${escapeRegex(id)}\\s*\\{[^}]*?)${escapeRegex(property)}\\s*:\\s*${escapeRegex(oldValue)}`,
          's'
        );

        if (idPattern.test(content)) {
          const newContent = content.replace(
            idPattern,
            `$1${property}: ${newValue}`
          );
          writeFileSync(fullPath, newContent, 'utf-8');
          return { success: true, filePath, strategy: 'id-based' };
        }
      } catch {
        continue;
      }
    }

    return { success: false };
  }

  private async tryInlineStyleReplace(req: StyleChangeRequest): Promise<StyleChangeResult> {
    const { property, oldValue, newValue, projectRoot } = req;

    // Convert kebab to camel for JSX style objects
    const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    // Search for inline style patterns in source files
    // Pattern 1: JSX style={{ property: 'value' }}
    const jsxPattern = `${camelProp}`;
    const files = grepFilesMultiGlob(jsxPattern, projectRoot, ['*.tsx', '*.jsx', '*.ts', '*.js']);

    for (const file of files) {
      const filePath = file.startsWith('./') ? file.slice(2) : file;
      if (filePath.includes('node_modules') || filePath.includes('/dist/') || filePath.includes('/.next/')) continue;

      const fullPath = `${projectRoot}/${filePath}`;
      try {
        const content = readFileSync(fullPath, 'utf-8');

        // Match: camelProp: 'oldValue' or camelProp: "oldValue"
        const stripUnit = oldValue.replace(/px$/, '');
        const patterns = [
          new RegExp(`(${escapeRegex(camelProp)}\\s*:\\s*)(['"])${escapeRegex(oldValue)}\\2`, 'g'),
          new RegExp(`(${escapeRegex(camelProp)}\\s*:\\s*)${escapeRegex(stripUnit)}(?=[,\\s}])`, 'g'),
        ];

        for (const pat of patterns) {
          if (pat.test(content)) {
            const newStripUnit = newValue.replace(/px$/, '');
            const newContent = content.replace(pat, (match, prefix, quote) => {
              if (quote) return `${prefix}${quote}${newValue}${quote}`;
              return `${prefix}${newStripUnit}`;
            });
            if (newContent !== content) {
              writeFileSync(fullPath, newContent, 'utf-8');
              return { success: true, filePath, strategy: 'inline-style' };
            }
          }
        }

        // Pattern 2: HTML style="property: value"
        const htmlPattern = new RegExp(
          `(style\\s*=\\s*["'][^"']*?)${escapeRegex(property)}\\s*:\\s*${escapeRegex(oldValue)}`,
          'g'
        );
        if (htmlPattern.test(content)) {
          const newContent = content.replace(htmlPattern, `$1${property}: ${newValue}`);
          writeFileSync(fullPath, newContent, 'utf-8');
          return { success: true, filePath, strategy: 'inline-style-html' };
        }
      } catch {
        continue;
      }
    }

    return { success: false };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
