# BuildOver

AI-powered development tool that lets you modify your web app through a chat widget. Type a request in the floating chat panel, and Claude Code edits your source files in real-time with HMR.

## How It Works

1. Your app runs on `localhost:3000` (or any port)
2. BuildOver starts a reverse proxy on `localhost:4100`
3. The proxy injects a chat widget into your page
4. You type a request (e.g., "Add a red border to the h1")
5. Claude Code reads, edits, and writes files
6. HMR hot-reloads the page instantly

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start your dev server (e.g., Next.js)
cd test-nextjs && pnpm dev

# In another terminal, start BuildOver
npx buildover dev --target 3000
```

Then open `http://localhost:4100` (not `:3000`) and click the chat bubble.

## CLI Options

```bash
npx buildover dev [options]

Options:
  -t, --target <url>   Target dev server URL or port (default: auto-detect or 3000)
  -p, --port <port>    BuildOver server port (default: 4100)
  -o, --open           Open browser automatically
  -h, --help           Show help
```

Examples:

```bash
# Auto-detect target port
npx buildover dev

# Specify target port
npx buildover dev --target 3000

# Specify full URL
npx buildover dev --target http://localhost:5173

# Custom BuildOver port
npx buildover dev --target 3000 --port 8080
```

## Authentication

Claude Code CLI must be installed and authenticated. The tool uses `claude -p` under the hood.

Alternatively, set one of these environment variables in a `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
# or
CLAUDE_CODE_OAUTH_TOKEN=...
```

## Architecture

```
Browser (:4100)  →  BuildOver Proxy  →  Your App (:3000)
                      ↕ WebSocket
                    Chat Widget (Shadow DOM)
                      ↕
                    Claude Code CLI
                      ↕
                    Source Files → HMR → Browser
```

- **Reverse Proxy**: `http-proxy-middleware` proxies all requests, injects widget `<script>` into HTML responses
- **Widget**: Preact app in Shadow DOM (style isolation), IIFE bundle
- **WebSocket**: Real-time chat between widget and server (`/buildover/ws`)
- **Agent**: Spawns `claude -p` with `--output-format stream-json` for streaming responses
- **HMR**: File changes trigger hot-reload through the existing dev server

## Project Structure

```
packages/
  cli/       # CLI tool (commander)
  server/    # Express proxy + WebSocket + Claude agent
  widget/    # Preact chat widget (Shadow DOM, IIFE bundle via tsup)
test-nextjs/ # Test Next.js app
```

## Widget Keyboard Shortcut

`Ctrl+Shift+B` - Toggle the chat panel

## Development

```bash
# Build all packages
pnpm build

# Build individual package
pnpm --filter @buildover/widget build
pnpm --filter @buildover/server build
pnpm --filter @buildover/cli build
```
