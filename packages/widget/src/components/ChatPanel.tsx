import { h } from 'preact';
import type { Message, FileChange, AIStatus } from '../types';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { StatusBar } from './StatusBar';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  fileChanges: FileChange[];
  status: AIStatus;
  statusMessage?: string;
  onSend: (message: string, createBranch: boolean) => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  fileChanges,
  status,
  statusMessage,
  onSend,
}: ChatPanelProps) {
  return (
    <div className={`buildover-panel ${isOpen ? '' : 'closed'}`}>
      <div className="buildover-header">
        <h3>BuildOver AI</h3>
        <button className="buildover-close" onClick={onClose}>
          ×
        </button>
      </div>
      <MessageList messages={messages} fileChanges={fileChanges} />
      <StatusBar status={status} message={statusMessage} />
      <InputBar onSend={onSend} disabled={status !== 'idle' && status !== 'done'} />
    </div>
  );
}
