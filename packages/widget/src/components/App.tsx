import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { Message, FileChange, AIStatus, ServerMessage } from '../types';
import { WebSocketClient } from '../ws/client';
import { FAB } from './FAB';
import { ChatPanel } from './ChatPanel';

interface AppProps {
  wsUrl: string;
}

export function App({ wsUrl }: AppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>();
  const [wsClient] = useState(() => new WebSocketClient(wsUrl));

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Handle incoming messages
    const unsubscribe = wsClient.onMessage((message: ServerMessage) => {
      handleServerMessage(message);
    });

    // Keyboard shortcut: Ctrl+Shift+B
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      wsClient.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [wsClient]);

  const handleServerMessage = (message: ServerMessage) => {
    switch (message.type) {
      case 'stream': {
        const messageId = message.messageId || 'temp';
        setMessages((prev) => {
          const existingIdx = prev.findIndex((m) => m.id === messageId);
          if (existingIdx >= 0) {
            // Update existing streaming message
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              content: updated[existingIdx].content + message.content,
            };
            return updated;
          } else {
            // Create new streaming message
            return [
              ...prev,
              {
                id: messageId,
                role: 'assistant',
                content: message.content,
                timestamp: Date.now(),
                streaming: true,
              },
            ];
          }
        });
        break;
      }

      case 'stream.end': {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.messageId ? { ...m, streaming: false } : m
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
  };

  const handleSend = (message: string, createBranch: boolean) => {
    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      },
    ]);

    // Send to server
    wsClient.send({
      type: 'chat',
      content: message,
      createBranch,
    });

    // Set status to analyzing
    setStatus('analyzing');
  };

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
