import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

interface InputBarProps {
  onSend: (message: string, createBranch: boolean) => void;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [message, setMessage] = useState('');
  const [createBranch, setCreateBranch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed, createBranch);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  return (
    <div className="buildover-input-bar">
      <div className="buildover-input-container">
        <textarea
          ref={textareaRef}
          className="buildover-input"
          placeholder="Ask BuildOver AI..."
          value={message}
          onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          className="buildover-send-btn"
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
        >
          Send
        </button>
      </div>
      <label className="buildover-branch-toggle">
        <input
          type="checkbox"
          checked={createBranch}
          onChange={(e) => setCreateBranch((e.target as HTMLInputElement).checked)}
        />
        Create new branch
      </label>
    </div>
  );
}
