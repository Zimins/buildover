import { h, render } from 'preact';
import { App } from './components/App';

// CSS will be inlined here during build
const CSS = `__CSS_PLACEHOLDER__`;

// Initialize the widget
(function () {
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

  // Get WebSocket URL from current page
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/buildover/ws`;

  // Render app
  render(h(App, { wsUrl }), root);

  console.log('[BuildOver] Widget initialized');
})();
