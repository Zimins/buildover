# @buildover/widget

Browser-side chat widget for BuildOver AI assistant.

## Overview

This package provides a self-contained chat widget that can be injected into any web page. It features:

- 💬 Floating Action Button (FAB) for quick access
- 🎨 Shadow DOM for complete style isolation
- 🌓 Dark/light theme support via `prefers-color-scheme`
- 🔌 WebSocket client with auto-reconnect
- 📝 Real-time message streaming
- 📁 File change cards with expandable diffs
- ⌨️ Keyboard shortcut: `Ctrl+Shift+B` to toggle

## Build

```bash
pnpm build
```

This produces a single `dist/widget.js` file that can be loaded via `<script>` tag.

## Usage

The widget automatically initializes when loaded and connects to the WebSocket endpoint at `/buildover/ws`.

```html
<script src="/path/to/widget.js"></script>
```

## Architecture

- **Entry**: `src/index.ts` - Creates Shadow DOM and mounts the app
- **Components**: Preact components for UI
- **WebSocket**: Auto-reconnecting client in `src/ws/client.ts`
- **Styles**: CSS in `src/styles/widget.css`, inlined during build
- **Build**: tsup bundles everything as IIFE with inlined CSS

## Features

### UI Components

- `FAB.tsx` - Floating action button (bottom-right)
- `ChatPanel.tsx` - Expandable chat panel (400x600px)
- `MessageList.tsx` - Message list with auto-scroll
- `InputBar.tsx` - Text input with send button and branch toggle
- `FileCard.tsx` - File change summary with expandable diff
- `StatusBar.tsx` - AI status indicator (analyzing/editing/done)

### WebSocket Protocol

#### Client Messages
```typescript
{
  type: 'chat',
  content: string,
  createBranch?: boolean
}
```

#### Server Messages
```typescript
// Stream chunk
{ type: 'stream', content: string, messageId?: string }

// Stream end
{ type: 'stream.end', messageId: string }

// File change
{
  type: 'file.changed',
  path: string,
  additions: number,
  deletions: number,
  diff?: string
}

// Status update
{
  type: 'status',
  status: 'analyzing' | 'editing' | 'done' | 'idle',
  message?: string
}

// Error
{ type: 'error', message: string }
```

## Tech Stack

- **UI Framework**: Preact (lightweight React alternative)
- **Bundler**: tsup (esbuild-based)
- **Language**: TypeScript
- **Styling**: Plain CSS with CSS custom properties
