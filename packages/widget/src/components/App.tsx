import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { FAB } from './FAB';
import { ChatPanel } from './ChatPanel';
import { WebSocketClient } from '../ws/client';
import type { Message, FileChange, AIStatus, ServerMessage } from '../types';

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
    if (!wsUrl) return;

    const ws = new WebSocketClient(wsUrl);
    wsRef.current = ws;

    ws.onMessage((message: ServerMessage) => {
      handleServerMessage(message);
    });

    ws.connect();

    // Keyboard shortcut: Ctrl+Shift+B
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
        setStatus(message.status);
        setStatusMessage(message.message);
        break;
      }

      case 'error': {
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
      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: Date.now(),
        },
      ]);

      // Reset file changes for new request
      setFileChanges([]);
      setStatus('analyzing');
      setStatusMessage('AI is analyzing your request...');

      // Send via WebSocket
      wsRef.current?.send({ type: 'chat', content, createBranch });
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
