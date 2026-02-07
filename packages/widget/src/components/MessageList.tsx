import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Message, FileChange } from '../types';
import { FileCard } from './FileCard';

interface MessageListProps {
  messages: Message[];
  fileChanges: FileChange[];
}

export function MessageList({ messages, fileChanges }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, fileChanges]);

  if (messages.length === 0 && fileChanges.length === 0) {
    return (
      <div className="buildover-empty">
        <div className="buildover-empty-icon">💬</div>
        <div className="buildover-empty-text">
          Start a conversation with BuildOver AI.
          <br />
          Ask questions or request code changes.
        </div>
      </div>
    );
  }

  return (
    <div className="buildover-messages">
      {messages.map((msg) => (
        <div key={msg.id} className={`buildover-message ${msg.role}`}>
          <div className="buildover-message-content">
            {renderMarkdown(msg.content)}
          </div>
          <div className="buildover-message-time">
            {formatTime(msg.timestamp)}
          </div>
        </div>
      ))}
      {fileChanges.map((file, idx) => (
        <FileCard key={`${file.path}-${idx}`} file={file} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function renderMarkdown(content: string) {
  // Simple markdown rendering for code blocks
  const parts: (string | h.JSX.Element)[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(...renderText(text));
    }

    // Add code block
    const language = match[1] || '';
    const code = match[2];
    parts.push(
      <pre key={match.index}>
        <code>{code}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    parts.push(...renderText(text));
  }

  return <div>{parts}</div>;
}

function renderText(text: string): (string | h.JSX.Element)[] {
  // Split by newlines and create paragraphs
  const lines = text.split('\n');
  const result: (string | h.JSX.Element)[] = [];

  lines.forEach((line, idx) => {
    if (line.trim()) {
      result.push(<p key={`line-${idx}`}>{line}</p>);
    }
  });

  return result.length > 0 ? result : [text];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
