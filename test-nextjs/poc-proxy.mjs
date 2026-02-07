#!/usr/bin/env node
import http from 'http';
import httpProxy from 'http-proxy';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PROXY_PORT = 4100;
const TARGET_URL = 'http://localhost:3000';

// Create proxy instance
const proxy = httpProxy.createProxyServer({
  target: TARGET_URL,
  ws: true, // Enable WebSocket proxying
  changeOrigin: true,
  xfwd: true,
});

// Track connected WebSocket clients
const wsClients = new Set();

// Widget JavaScript content
const widgetJS = `
(function() {
  console.log('[BuildOver] Widget loading...');

  // Create Shadow DOM container
  const container = document.createElement('div');
  container.id = 'buildover-widget-root';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });

  // Widget styles
  const style = document.createElement('style');
  style.textContent = \`
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: all 0.3s ease;
      z-index: 10000;
    }

    .fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .fab.active {
      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
    }

    .chat-panel {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 380px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      display: none;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
    }

    .chat-panel.visible {
      display: flex;
    }

    .chat-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      font-weight: 600;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
    }

    .message {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
    }

    .message.user {
      background: #667eea;
      color: white;
      margin-left: 40px;
    }

    .message.system {
      background: white;
      color: #374151;
      margin-right: 40px;
      border: 1px solid #e5e7eb;
    }

    .chat-input-container {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: white;
    }

    .chat-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      resize: none;
      outline: none;
    }

    .chat-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .status {
      padding: 8px 16px;
      font-size: 12px;
      color: #6b7280;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }

    .status.connected {
      color: #059669;
    }

    .status.disconnected {
      color: #dc2626;
    }
  \`;
  shadow.appendChild(style);

  // Create FAB (Floating Action Button)
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = '💬';
  fab.title = 'BuildOver Chat';
  shadow.appendChild(fab);

  // Create chat panel
  const chatPanel = document.createElement('div');
  chatPanel.className = 'chat-panel';
  chatPanel.innerHTML = \`
    <div class="chat-header">BuildOver AI Assistant</div>
    <div class="chat-messages" id="messages"></div>
    <div class="chat-input-container">
      <textarea class="chat-input" id="chat-input" placeholder="Type a message..." rows="2"></textarea>
    </div>
    <div class="status" id="status">Connecting...</div>
  \`;
  shadow.appendChild(chatPanel);

  const messagesContainer = shadow.getElementById('messages');
  const chatInput = shadow.getElementById('chat-input');
  const statusDiv = shadow.getElementById('status');

  // Toggle chat panel
  let isOpen = false;
  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    chatPanel.classList.toggle('visible', isOpen);
    fab.classList.toggle('active', isOpen);
    if (isOpen) {
      chatInput.focus();
    }
  });

  // Add message to chat
  function addMessage(text, type = 'system') {
    const message = document.createElement('div');
    message.className = \`message \${type}\`;
    message.textContent = text;
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // WebSocket connection
  let ws = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${window.location.host}/buildover/ws\`;

    console.log('[BuildOver] Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[BuildOver] WebSocket connected');
      statusDiv.textContent = 'Connected ✓';
      statusDiv.className = 'status connected';
      reconnectAttempts = 0;
      addMessage('Connected to BuildOver AI. How can I help you?', 'system');
    };

    ws.onmessage = (event) => {
      console.log('[BuildOver] Received:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          addMessage(data.content, 'system');
        }
      } catch (e) {
        addMessage(event.data, 'system');
      }
    };

    ws.onerror = (error) => {
      console.error('[BuildOver] WebSocket error:', error);
      statusDiv.textContent = 'Connection error';
      statusDiv.className = 'status disconnected';
    };

    ws.onclose = () => {
      console.log('[BuildOver] WebSocket closed');
      statusDiv.textContent = 'Disconnected';
      statusDiv.className = 'status disconnected';

      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        console.log(\`[BuildOver] Reconnecting in \${delay}ms... (attempt \${reconnectAttempts})\`);
        setTimeout(connect, delay);
      } else {
        statusDiv.textContent = 'Connection failed. Refresh to retry.';
      }
    };
  }

  // Send message
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

    addMessage(text, 'user');
    ws.send(JSON.stringify({ type: 'chat', content: text }));
    chatInput.value = '';
  }

  // Handle input
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Initialize
  connect();

  console.log('[BuildOver] Widget loaded successfully');
})();
`;

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Serve widget JavaScript
  if (req.url === '/buildover/widget.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
    });
    res.end(widgetJS);
    return;
  }

  // Handle other /buildover/* routes (if any)
  if (req.url.startsWith('/buildover/')) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Proxy all other requests to Next.js dev server
  // We need to use selfHandleResponse to intercept HTML
  proxy.web(req, res, { selfHandleResponse: true }, (err) => {
    if (err) {
      console.error('[Proxy Error]', err);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Bad Gateway');
      }
    }
  });
});

// Intercept HTML responses to inject widget script
proxy.on('proxyRes', (proxyRes, req, res) => {
  const contentType = proxyRes.headers['content-type'] || '';

  // Copy headers from proxy response
  Object.keys(proxyRes.headers).forEach(key => {
    res.setHeader(key, proxyRes.headers[key]);
  });

  // Only inject into HTML responses
  if (contentType.includes('text/html')) {
    console.log('[Injecting] Widget script into HTML response');
    let body = [];

    proxyRes.on('data', (chunk) => {
      body.push(chunk);
    });

    proxyRes.on('end', () => {
      const bodyString = Buffer.concat(body).toString();

      // Inject widget script before </body>
      const injectedBody = bodyString.replace(
        '</body>',
        '<script src="/buildover/widget.js"></script></body>'
      );

      // Update content-length
      const newBuffer = Buffer.from(injectedBody);
      res.setHeader('content-length', newBuffer.length);

      res.writeHead(proxyRes.statusCode);
      res.end(newBuffer);
    });
  } else {
    // For non-HTML responses, just pipe through
    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  }
});

// Handle WebSocket upgrade requests
server.on('upgrade', (req, socket, head) => {
  console.log(`[WebSocket] Upgrade request: ${req.url}`);

  if (req.url === '/buildover/ws') {
    // Handle BuildOver WebSocket
    handleBuildOverWebSocket(req, socket, head);
  } else {
    // Proxy other WebSocket requests (e.g., Next.js HMR)
    console.log('[WebSocket] Proxying to Next.js:', req.url);
    proxy.ws(req, socket, head, (err) => {
      if (err) {
        console.error('[WebSocket Proxy Error]', err);
        socket.destroy();
      }
    });
  }
});

// Handle BuildOver WebSocket connections
function handleBuildOverWebSocket(req, socket, head) {
  // Simple WebSocket handshake implementation
  const key = req.headers['sec-websocket-key'];
  const hash = require('crypto')
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${hash}`,
    '',
    ''
  ].join('\r\n');

  socket.write(headers);

  console.log('[BuildOver WS] Client connected');
  wsClients.add(socket);

  // Send welcome message
  sendWebSocketMessage(socket, {
    type: 'message',
    content: 'Welcome to BuildOver! This is a proof-of-concept WebSocket connection.'
  });

  socket.on('data', (buffer) => {
    try {
      const message = parseWebSocketFrame(buffer);
      if (message) {
        console.log('[BuildOver WS] Received:', message);

        // Echo back a response
        const data = JSON.parse(message);
        if (data.type === 'chat') {
          sendWebSocketMessage(socket, {
            type: 'message',
            content: `You said: "${data.content}". This is a PoC - AI integration would go here.`
          });
        }
      }
    } catch (err) {
      console.error('[BuildOver WS] Error parsing message:', err);
    }
  });

  socket.on('close', () => {
    console.log('[BuildOver WS] Client disconnected');
    wsClients.delete(socket);
  });

  socket.on('error', (err) => {
    console.error('[BuildOver WS] Socket error:', err);
    wsClients.delete(socket);
  });
}

// Simple WebSocket frame parser (only supports text frames)
function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];

  const opcode = firstByte & 0x0F;
  const isMasked = (secondByte & 0x80) === 0x80;

  // Only handle text frames (opcode 1)
  if (opcode !== 1) return null;

  let payloadLength = secondByte & 0x7F;
  let offset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    payloadLength = buffer.readBigUInt64BE(2);
    offset = 10;
  }

  if (isMasked) {
    const maskingKey = buffer.slice(offset, offset + 4);
    offset += 4;

    const payload = buffer.slice(offset, offset + Number(payloadLength));
    const decoded = Buffer.alloc(payload.length);

    for (let i = 0; i < payload.length; i++) {
      decoded[i] = payload[i] ^ maskingKey[i % 4];
    }

    return decoded.toString('utf8');
  }

  return buffer.slice(offset, offset + Number(payloadLength)).toString('utf8');
}

// Send WebSocket message
function sendWebSocketMessage(socket, data) {
  const message = JSON.stringify(data);
  const messageBuffer = Buffer.from(message);
  const length = messageBuffer.length;

  let frame;
  if (length < 126) {
    frame = Buffer.allocUnsafe(2 + length);
    frame[0] = 0x81; // FIN + text frame
    frame[1] = length;
    messageBuffer.copy(frame, 2);
  } else if (length < 65536) {
    frame = Buffer.allocUnsafe(4 + length);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    messageBuffer.copy(frame, 4);
  } else {
    frame = Buffer.allocUnsafe(10 + length);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
    messageBuffer.copy(frame, 10);
  }

  socket.write(frame);
}

// Start server
server.listen(PROXY_PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║      BuildOver Proxy Server (PoC)           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║                                              ║');
  console.log(`║  Proxy Server:    http://localhost:${PROXY_PORT}   ║`);
  console.log(`║  Target (Next.js): ${TARGET_URL}            ║`);
  console.log('║                                              ║');
  console.log('║  ✓ Reverse proxy enabled                     ║');
  console.log('║  ✓ Widget injection active                   ║');
  console.log('║  ✓ WebSocket ready (/buildover/ws)           ║');
  console.log('║                                              ║');
  console.log(`║  ➜ Open http://localhost:${PROXY_PORT}          ║`);
  console.log('║    (Next.js app + BuildOver widget)          ║');
  console.log('║                                              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('Waiting for connections...');
  console.log('');
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('[Proxy Error]', err);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error: Unable to connect to Next.js dev server.\n\nMake sure Next.js is running on port 3000.');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down BuildOver proxy...');
  wsClients.forEach(socket => socket.destroy());
  server.close(() => {
    console.log('Proxy server stopped.');
    process.exit(0);
  });
});
