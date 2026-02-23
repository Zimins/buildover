import { h } from 'preact';
import { useState } from 'preact/hooks';
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
  onClear: () => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  fileChanges,
  status,
  statusMessage,
  onSend,
  onClear,
}: ChatPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className={`buildover-panel ${isOpen ? '' : 'closed'} ${showHistory ? 'expanded' : 'compact'}`}>
      {showHistory && <MessageList messages={messages} fileChanges={fileChanges} />}
      {showHistory && <StatusBar status={status} message={statusMessage} />}
      <InputBar
        onSend={onSend}
        onClear={onClear}
        disabled={status !== 'idle' && status !== 'done'}
        status={status}
        statusMessage={statusMessage}
        showStatus={!showHistory}
      />
    </div>
  );
}
