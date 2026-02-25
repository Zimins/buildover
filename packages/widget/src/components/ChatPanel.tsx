import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Message, FileChange, AIStatus } from '../types';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { StatusBar } from './StatusBar';

interface PRButtonProps {
  loading: boolean;
  requested: boolean;
  onClick: () => void;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  fileChanges: FileChange[];
  status: AIStatus;
  statusMessage?: string;
  onSend: (message: string, createBranch: boolean) => void;
  onClear: () => void;
  prButton?: PRButtonProps;
  onCreateLink?: () => Promise<string>;
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
  prButton,
  onCreateLink,
}: ChatPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className={`buildover-panel ${isOpen ? '' : 'closed'} ${showHistory ? 'expanded' : 'compact'}`}>
      {prButton && (
        <div className="buildover-pr-bar">
          {prButton.requested ? (
            <span className="buildover-pr-requested">✓ 병합 요청 전송됨</span>
          ) : (
            <button
              onClick={prButton.onClick}
              disabled={prButton.loading}
              className="buildover-pr-button"
            >
              {prButton.loading ? '전송 중...' : '병합 요청 보내기'}
            </button>
          )}
        </div>
      )}
      {showHistory && <MessageList messages={messages} fileChanges={fileChanges} />}
      {showHistory && <StatusBar status={status} message={statusMessage} />}
      <InputBar
        onSend={onSend}
        onClear={onClear}
        disabled={status !== 'idle' && status !== 'done'}
        status={status}
        statusMessage={statusMessage}
        showStatus={!showHistory}
        onCreateLink={onCreateLink}
      />
    </div>
  );
}
