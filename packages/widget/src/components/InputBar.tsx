import { h } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import type { AIStatus } from '../types';
import { useElementPicker } from '../hooks/useElementPicker';
import { ElementChip } from './ElementChip';
import type { SelectorResult } from '../utils/generateSelector';

interface InputBarProps {
  onSend: (message: string, createBranch: boolean) => void;
  onClear: () => void;
  disabled?: boolean;
  status?: AIStatus;
  statusMessage?: string;
  showStatus?: boolean;
  onCreateLink?: () => Promise<string>;
  designMode?: boolean;
  onDesignModeToggle?: () => void;
}

export function InputBar({ onSend, onClear, disabled, status, statusMessage, showStatus, onCreateLink, designMode, onDesignModeToggle }: InputBarProps) {
  const [linkCreating, setLinkCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedElement, setSelectedElement] = useState<SelectorResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isActive, activate, deactivate } = useElementPicker({
    onSelect: (result) => {
      setSelectedElement(result);
    },
  });

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    const prefix = selectedElement ? `[Element: ${selectedElement.selector}] ` : '';
    onSend(prefix + trimmed, false);
    setMessage('');
    setSelectedElement(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCreateLink = useCallback(async () => {
    if (!onCreateLink || linkCreating) return;
    setLinkCreating(true);
    setCreatedUrl(null);
    try {
      const url = await onCreateLink();
      setCreatedUrl(url);
    } finally {
      setLinkCreating(false);
    }
  }, [onCreateLink, linkCreating]);

  const handleCopy = useCallback(() => {
    if (!createdUrl) return;
    navigator.clipboard.writeText(createdUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [createdUrl]);

  const handlePickerToggle = () => {
    if (isActive) {
      deactivate();
    } else {
      activate();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 240) + 'px';
    }
  }, [message]);

  return (
    <div className="buildover-input-bar">
      {showStatus && (status === 'analyzing' || status === 'editing') && (
        <div className={`buildover-status-inline buildover-status ${status}`}>
          <span className="buildover-status-icon">⟳</span>
          {statusMessage}
        </div>
      )}
      <div className={`buildover-input-wrapper${selectedElement ? ' has-chip' : ''}`}>
        {selectedElement && (
          <ElementChip
            tagName={selectedElement.tagName}
            selector={selectedElement.selector}
            onRemove={() => setSelectedElement(null)}
          />
        )}
        <textarea
          ref={textareaRef}
          className="buildover-input"
          placeholder={'변경하고 싶은 내용을 설명해주세요...\n\n⌘+Enter로 전송'}
          value={message}
          onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={4}
        />
      </div>
      {createdUrl && (
        <div className="buildover-share-result">
          <a href={createdUrl} target="_blank" rel="noopener noreferrer" className="buildover-share-url">
            {createdUrl}
          </a>
          <button className="buildover-copy-btn" onClick={handleCopy} title="URL 복사">
            {copied ? '✓' : '복사'}
          </button>
          <button className="buildover-share-close" onClick={() => setCreatedUrl(null)} title="닫기">
            ✕
          </button>
        </div>
      )}
      <div className="buildover-input-footer">
        <div className="buildover-input-footer-left">
          <button
            className="buildover-clear-btn"
            onClick={onClear}
            disabled={disabled}
            title="대화를 초기화하고 새 세션 시작"
          >
            새 대화
          </button>
          <button
            className={`buildover-picker-btn${isActive ? ' active' : ''}`}
            onClick={handlePickerToggle}
            disabled={disabled}
            title={isActive ? '요소 선택 취소 (Esc)' : '페이지에서 요소 선택'}
            type="button"
          >
            ⊕
          </button>
          {onDesignModeToggle && (
            <button
              className={`buildover-design-toggle-btn${designMode ? ' active' : ''}`}
              onClick={onDesignModeToggle}
              disabled={disabled}
              title={designMode ? 'Exit design mode' : 'Design mode'}
              type="button"
            >
              Design
            </button>
          )}
          {onCreateLink && (
            <button
              className="buildover-share-btn"
              onClick={handleCreateLink}
              disabled={linkCreating}
              title="새 공유 링크 만들기 (독립된 서브 서버)"
              type="button"
            >
              {linkCreating ? '생성 중...' : '🔗 링크'}
            </button>
          )}
        </div>
        <button
          className="buildover-send-btn"
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
        >
          전송 <kbd>⌘↵</kbd>
        </button>
      </div>
    </div>
  );
}
