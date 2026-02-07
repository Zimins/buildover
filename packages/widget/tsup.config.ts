import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  splitting: false,
  minify: true,
  clean: true,
  globalName: 'BuildOverWidget',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  inject: ['./jsx-shim.ts'],
  esbuildOptions(options) {
    options.banner = {
      js: '/* BuildOver Chat Widget */',
    };
  },
  async onSuccess() {
    // Inline CSS after build
    const fs = await import('fs/promises');
    const path = await import('path');

    const cssPath = path.resolve(process.cwd(), 'src/styles/widget.css');
    const distPath = path.resolve(process.cwd(), 'dist/index.js');

    const css = await fs.readFile(cssPath, 'utf-8');
    let js = await fs.readFile(distPath, 'utf-8');

    // Replace placeholder with actual CSS
    // Escape backslashes, backticks, and newlines so CSS works inside any JS string type
    const escapedCss = css
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    js = js.replace('__CSS_PLACEHOLDER__', escapedCss);

    await fs.writeFile(distPath, js);

    // Rename to widget.js
    const widgetPath = path.resolve(process.cwd(), 'dist/widget.js');
    await fs.rename(distPath, widgetPath);

    console.log('✓ CSS inlined and output renamed to widget.js');
  },
});
