import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { FAB } from './FAB';
import { ChatPanel } from './ChatPanel';
import { WebSocketClient } from '../ws/client';
import type { Message, FileChange, AIStatus, ServerMessage } from '../types';

const log = (msg: string, ...args: any[]) => console.log(`[BuildOver] ${msg}`, ...args);
const logWarn = (msg: string, ...args: any[]) => console.warn(`[BuildOver] ${msg}`, ...args);

interface AppProps {
  wsUrl?: string;
}

export function App({ wsUrl }: AppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const wsRef = useRef<WebSocketClient | null>(null);
  const streamBufferRef = useRef<{ [messageId: string]: string }>({});

  useEffect(() => {
    if (!wsUrl) {
      logWarn('No wsUrl provided, WebSocket disabled');
      return;
    }

    log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocketClient(wsUrl);
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
        log(`Stream: msgId=${msgId}, total=${buffer[msgId].length} chars`);

        setMessages((prev) => {
          const existing = prev.find(
            (m) => m.id === msgId && m.role === 'assistant'
          );
          if (existing) {
            return prev.map((m) =>
              m.id === msgId && m.role === 'assistant'
                ? { ...m, content: buffer[msgId], streaming: true }
                : m
            );
          }
          return [
            ...prev,
            {
              id: msgId,
              role: 'assistant',
              content: buffer[msgId],
              timestamp: Date.now(),
              streaming: true,
            },
          ];
        });
        break;
      }

      case 'stream.end': {
        const msgId = message.messageId;
        log(`Stream ended: msgId=${msgId}`);
        delete streamBufferRef.current[msgId];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId && m.role === 'assistant'
              ? { ...m, streaming: false }
              : m
          )
        );
        break;
      }

      case 'file.changed': {
        log(`File changed: ${message.path}`);
        setFileChanges((prev) => [
          ...prev,
          {
            path: message.path,
            additions: message.additions,
            deletions: message.deletions,
            diff: message.diff,
          },
        ]);
        break;
      }

      case 'status': {
        log(`Status: ${message.status} - ${message.message}`);
        setStatus(message.status);
        setStatusMessage(message.message);
        break;
      }

      case 'error': {
        logWarn(`Error from server: ${message.message}`);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${message.message}`,
            timestamp: Date.now(),
          },
        ]);
        setStatus('idle');
        break;
      }
    }
  }, []);

  const handleSend = useCallback(
    (content: string, createBranch: boolean) => {
      const connected = wsRef.current?.isConnected() || false;
      log(`Sending message: "${content.substring(0, 50)}...", ws connected: ${connected}`);

      if (!connected) {
        logWarn('WebSocket not connected! Message may not be delivered.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: Date.now(),
        },
      ]);

      setFileChanges([]);
      setStatus('analyzing');
      setStatusMessage('AI is analyzing your request...');

      wsRef.current?.send({ type: 'chat', content, createBranch });
      log('Message sent via WebSocket');
    },
    []
  );

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="buildover-container">
      <FAB onClick={toggleOpen} isOpen={isOpen} />
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        fileChanges={fileChanges}
        status={status}
        statusMessage={statusMessage}
        onSend={handleSend}
      />
    </div>
  );
}
