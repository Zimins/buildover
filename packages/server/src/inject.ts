import { Transform } from 'stream';

export function createInjectorTransform(): Transform {
  let buffer = '';
  let injected = false;

  return new Transform({
    transform(chunk, encoding, callback) {
      buffer += chunk.toString();

      if (!injected && buffer.includes('</body>')) {
        const widgetScript = '<script src="/buildover/widget.js"></script>';
        buffer = buffer.replace('</body>', `${widgetScript}\n</body>`);
        injected = true;

        this.push(buffer);
        buffer = '';
      } else if (buffer.length > 100000) {
        this.push(buffer);
        buffer = '';
      }

      callback();
    },
    flush(callback) {
      if (buffer) {
        this.push(buffer);
      }
      callback();
    },
  });
}

export function injectWidget(html: string): string {
  const widgetScript = '<script src="/buildover/widget.js"></script>';

  if (html.includes('</body>')) {
    return html.replace('</body>', `${widgetScript}\n</body>`);
  }

  return html + widgetScript;
}
