import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

interface NotePanelProps {
  isOpen: boolean;
  onClose: () => void;
  notes: string;
  onSave: (content: string) => void;
  onClear: () => void;
}

export function NotePanel({
  isOpen,
  onClose,
  notes,
  onSave,
  onClear,
}: NotePanelProps) {
  const [content, setContent] = useState(notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(notes);
  }, [notes]);

  const handleSave = () => {
    onSave(content);
  };

  const handleClear = () => {
    if (confirm('모든 메모를 삭제하시겠습니까?')) {
      setContent('');
      onClear();
    }
  };

  return (
    <div className={`buildover-panel ${isOpen ? '' : 'closed'}`}>
      <div className="buildover-header">
        <h3>메모장</h3>
        <button className="buildover-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="note-content">
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={content}
          onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
          placeholder="메모를 입력하세요..."
        />
      </div>
      <div className="note-actions">
        <button className="btn btn-primary" onClick={handleSave}>
          저장
        </button>
        <button className="btn btn-secondary" onClick={handleClear}>
          전체 삭제
        </button>
        <span className="note-info">
          자동 저장됨 ({content.length} 글자)
        </span>
      </div>
    </div>
  );
}
