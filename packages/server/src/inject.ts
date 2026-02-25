import { Transform } from 'stream';

function buildWidgetScript(linkId?: string, explicitSrc?: string, explicitWsUrl?: string, explicitApiBase?: string): string {
  const src = explicitSrc ?? (linkId ? `/s/${linkId}` : '') + '/buildover/widget.js';
  let attrs = '';
  if (linkId) attrs += ` data-buildover-link="${linkId}"`;
  if (explicitWsUrl) attrs += ` data-buildover-ws="${explicitWsUrl}"`;
  if (explicitApiBase) attrs += ` data-buildover-api="${explicitApiBase}"`;
  return `<script src="${src}"${attrs}></script>`;
}

export function createInjectorTransform(linkId?: string, explicitSrc?: string, explicitWsUrl?: string, explicitApiBase?: string): Transform {
  let buffer = '';
  let injected = false;

  return new Transform({
    transform(chunk, encoding, callback) {
      buffer += chunk.toString();

      if (!injected && buffer.includes('</body>')) {
        const widgetScript = buildWidgetScript(linkId, explicitSrc, explicitWsUrl, explicitApiBase);
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

export function injectWidget(html: string, linkId?: string, explicitSrc?: string, explicitWsUrl?: string, explicitApiBase?: string): string {
  const widgetScript = buildWidgetScript(linkId, explicitSrc, explicitWsUrl, explicitApiBase);

  if (html.includes('</body>')) {
    return html.replace('</body>', `${widgetScript}\n</body>`);
  }

  return html + widgetScript;
}
