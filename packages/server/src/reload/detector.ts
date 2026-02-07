import { readFile } from 'fs/promises';
import { join } from 'path';
import { FRAMEWORK_STRATEGIES, FrameworkInfo } from './strategies.js';

export async function detectFramework(projectRoot: string): Promise<FrameworkInfo | null> {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const [key, framework] of Object.entries(FRAMEWORK_STRATEGIES)) {
      if (allDeps[key] || allDeps[`@${key}/core`]) {
        return framework;
      }
    }

    if (allDeps['react-scripts']) {
      return FRAMEWORK_STRATEGIES['create-react-app'];
    }

    if (allDeps['@sveltejs/kit']) {
      return FRAMEWORK_STRATEGIES['svelte'];
    }

    return null;
  } catch {
    return null;
  }
}
