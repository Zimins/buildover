import { h, render } from 'preact';
import { App } from './components/App';

// CSS will be inlined here during build
const CSS = `__CSS_PLACEHOLDER__`;

// Initialize the widget
(function () {
  // Detect linkId and explicit URLs from script tag attributes
  const scriptTag = document.currentScript as HTMLScriptElement | null;
  const linkId = scriptTag?.getAttribute('data-buildover-link') || '';
  const explicitWsUrl = scriptTag?.getAttribute('data-buildover-ws') || '';
  const explicitApiBase = scriptTag?.getAttribute('data-buildover-api') || '';
  const basePath = linkId ? `/s/${linkId}` : '';

  // Create shadow host
  const host = document.createElement('div');
  host.id = 'buildover-widget-host';
  document.body.appendChild(host);

  // Attach shadow DOM for style isolation
  const shadow = host.attachShadow({ mode: 'open' });

  // Create style element and inject CSS
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.appendChild(style);

  // Create root element for Preact
  const root = document.createElement('div');
  shadow.appendChild(root);

  // Build WebSocket URL: explicit (mini-proxy mode) > path-prefix mode > default
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = explicitWsUrl || `${protocol}//${window.location.host}${basePath}/buildover/ws`;

  // Render app
  render(h(App, {
    wsUrl,
    linkId: linkId || undefined,
    basePath: basePath || undefined,
    apiBase: explicitApiBase || undefined,
  }), root);

  console.log('[BuildOver] Widget initialized', linkId ? `(share link: ${linkId})` : '');
})();
