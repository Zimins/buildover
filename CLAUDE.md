# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (use pnpm, not npm)
pnpm install

# Build all packages (widget → server → cli, in dependency order via turbo)
pnpm build

# Build a single package
pnpm --filter buildover-widget build
pnpm --filter buildover-server build
pnpm --filter buildover build          # CLI package

# Watch mode for a single package
pnpm --filter buildover-widget dev

# Type-check without emitting
pnpm --filter buildover lint

# Run the tool locally (after building)
cd test-nextjs && pnpm dev             # Terminal 1: start target app on :3000
node packages/cli/dist/index.js dev --target 3000  # Terminal 2: start BuildOver on :4100
```

## Architecture

BuildOver is an **AI-powered dev tool** that wraps any running web app with a chat widget. It works as a reverse proxy — you visit `localhost:4100` instead of `localhost:3000`, and a floating chat panel lets you ask Claude to modify your source files in real-time with HMR.

### Package Dependency Chain

```
packages/cli (buildover)
  └─ depends on → packages/server (buildover-server)
                    └─ depends on → packages/widget (buildover-widget)
```

All packages are TypeScript + tsup. The build order matters: widget → server → cli.

### Request Flow

```
Browser (:4100) → Express server
  ├─ GET /buildover/widget.js   → serves dist/widget.js (IIFE bundle with inlined CSS)
  ├─ /buildover/ws              → WebSocket (chat communication)
  ├─ /buildover/api/*           → REST API (sessions, diff, branches)
  └─ everything else            → http-proxy-middleware → target app (:3000)
                                   HTML responses get <script src="/buildover/widget.js">
                                   injected before </body>
```

### Widget Build Quirk

The widget is an IIFE bundle (not ESM). CSS is compiled separately and injected at build time via a `__CSS_PLACEHOLDER__` string in `src/index.ts`. The `tsup.config.ts` `onSuccess` hook reads `src/styles/widget.css`, escapes it (newlines, backticks, `$`, backslashes), replaces the placeholder in the built JS, then renames `dist/index.js` → `dist/widget.js`.

### Claude Agent Integration

`packages/server/src/agent/claude.ts` spawns `claude -p` as a subprocess:
- **stdin must be closed immediately** (`stdin.end()`) or the CLI hangs waiting for EOF
- `--verbose` is required when using `--output-format stream-json`
- `--permission-mode bypassPermissions` is used with `--allowedTools Read,Edit,Write,Glob,Grep`
- Stream events arrive as newline-delimited JSON: `{type:"system"}`, `{type:"assistant", message:{content:[...]}}`, `{type:"result"}`
- Text blocks: `block.type === 'text'`, `block.text`
- Tool use blocks: `block.type === 'tool_use'`, `block.name`, `block.input`
- The agent resolves the `claude` binary from `~/.claude/local/claude` first, then `which claude`

### WebSocket Protocol

Widget ↔ Server communicate via `/buildover/ws`:

- **Client → Server**: `{type:"init", sessionId}`, `{type:"chat", content}`
- **Server → Client**: `{type:"stream", content, messageId}`, `{type:"stream.end", messageId}`, `{type:"status", status, message}`, `{type:"file.changed", path}`, `{type:"error", message}`

### Key Files

| File | Role |
|------|------|
| `packages/cli/src/commands/dev.ts` | CLI `dev` command — normalizes target URL, starts server |
| `packages/server/src/server.ts` | Express + WebSocket server, route setup, chat handling |
| `packages/server/src/proxy.ts` | Reverse proxy with HTML response interceptor |
| `packages/server/src/inject.ts` | Injects `<script>` tag into proxied HTML |
| `packages/server/src/agent/claude.ts` | Spawns claude CLI, parses stream-json, emits events |
| `packages/server/src/git/manager.ts` | simple-git wrapper for branch management |
| `packages/widget/src/index.ts` | Shadow DOM setup, Preact render, WebSocket URL construction |
| `packages/widget/src/components/App.tsx` | Widget root component |
| `packages/widget/tsup.config.ts` | IIFE build + CSS inline post-processing |

### Target URL Normalization (CLI)

The CLI normalizes `--target` before passing it to the server:
- Digits only (e.g. `3000`) → `http://localhost:3000`
- No protocol (e.g. `localhost:3000`) → `http://localhost:3000`
- Full URL passed as-is

### Package Names

npm names differ from directory names:
- `packages/cli` → published as `buildover` (the `buildover` binary)
- `packages/server` → published as `buildover-server`
- `packages/widget` → published as `buildover-widget`
