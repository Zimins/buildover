import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { FAB } from './FAB';
import { ChatPanel } from './ChatPanel';
import { HistorySidebar } from './HistorySidebar';
import { WebSocketClient } from '../ws/client';
import type { Message, FileChange, AIStatus, ServerMessage, CommitEntry } from '../types';

const log = (msg: string, ...args: any[]) => console.log(`[BuildOver] ${msg}`, ...args);
const logWarn = (msg: string, ...args: any[]) => console.warn(`[BuildOver] ${msg}`, ...args);

const SESSION_KEY = 'buildover-session-id';

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface AppProps {
  wsUrl?: string;
}

export function App({ wsUrl }: AppProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef = useRef<WebSocketClient | null>(null);
  const streamBufferRef = useRef<{ [messageId: string]: string }>({});

  const apiBase = wsUrl
    ? wsUrl.replace(/^ws/, 'http').replace(/\/buildover\/ws$/, '')
    : '';

  useEffect(() => {
    if (!wsUrl) {
      logWarn('No wsUrl provided, WebSocket disabled');
      return;
    }

    if (apiBase) {
      fetch(`${apiBase}/buildover/api/commits?limit=30`)
        .then(r => r.json())
        .then((data: CommitEntry[]) => {
          if (Array.isArray(data)) setCommits(data);
        })
        .catch(err => logWarn('Failed to fetch commits:', err));
    }

    const sessionId = getOrCreateSessionId();
    log(`Session ID: ${sessionId}`);

    log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocketClient(wsUrl, sessionId);
    wsRef.current = ws;

    ws.onMessage((message: ServerMessage) => {
      log(`Server message: type=${message.type}`, message);
      handleServerMessage(message);
    });

    ws.connect();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ws.disconnect();
    };
  }, [wsUrl]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'stream': {
        const msgId = message.messageId || 'default';
        const buffer = streamBufferRef.current;
        buffer[msgId] = (buffer[msgId] || '') + message.content;

        setMessages((prev) => {
          const existing = prev.find((m) => m.id === msgId && m.role === 'assistant');
          if (existing) {
            return prev.map((m) =>
              m.id === msgId && m.role === 'assistant'
                ? { ...m, content: buffer[msgId], streaming: true }
                : m
            );
          }
          return [
            ...prev,
            { id: msgId, role: 'assistant', content: buffer[msgId], timestamp: Date.now(), streaming: true },
          ];
        });
        break;
      }

      case 'stream.end': {
        const msgId = message.messageId;
        delete streamBufferRef.current[msgId];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId && m.role === 'assistant' ? { ...m, streaming: false } : m
          )
        );
        break;
      }

      case 'file.changed': {
        setFileChanges((prev) => [
          ...prev,
          { path: message.path, additions: message.additions, deletions: message.deletions, diff: message.diff },
        ]);
        break;
      }

      case 'status': {
        setStatus(message.status);
        setStatusMessage(message.message);
        break;
      }

      case 'error': {
        logWarn(`Error from server: ${message.message}`);
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, role: 'assistant', content: `Error: ${message.message}`, timestamp: Date.now() },
        ]);
        setStatus('idle');
        break;
      }

      case 'commit.created': {
        setCommits((prev) => [message.commit, ...prev]);
        break;
      }

      case 'cleared': {
        log('Session cleared by server');
        setMessages([]);
        setFileChanges([]);
        setStatus('idle');
        setStatusMessage(undefined);
        streamBufferRef.current = {};
        break;
      }
    }
  }, []);

  const handleSend = useCallback((content: string, createBranch: boolean) => {
    const connected = wsRef.current?.isConnected() || false;
    if (!connected) logWarn('WebSocket not connected!');

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content, timestamp: Date.now() },
    ]);
    setFileChanges([]);
    setStatus('analyzing');
    setStatusMessage('AI가 요청을 분석하고 있어요...');

    wsRef.current?.send({ type: 'chat', content, createBranch });
  }, []);

  const handleClear = useCallback(() => {
    // Generate new sessionId so next reconnect starts fresh
    const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, newId);

    // Tell server to clear the current session
    wsRef.current?.send({ type: 'clear' });
  }, []);

  return (
    <div className="buildover-container">
      <HistorySidebar
        commits={commits}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        apiBase={apiBase}
      />
      <FAB onClick={() => setIsOpen((prev) => !prev)} isOpen={isOpen} />
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        fileChanges={fileChanges}
        status={status}
        statusMessage={statusMessage}
        onSend={handleSend}
        onClear={handleClear}
      />
    </div>
  );
}
