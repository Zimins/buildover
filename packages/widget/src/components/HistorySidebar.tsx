import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { CommitEntry } from '../types';

interface HistorySidebarProps {
  commits: CommitEntry[];
  isOpen: boolean;
  onToggle: () => void;
  apiBase: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HistorySidebar({ commits, isOpen, onToggle, apiBase }: HistorySidebarProps) {
  const [restoringHash, setRestoringHash] = useState<string | null>(null);
  const [activeHash, setActiveHash] = useState<string | null>(null);

  const handleRestore = async (hash: string) => {
    if (restoringHash) return;
    setRestoringHash(hash);
    try {
      const res = await fetch(`${apiBase}/buildover/api/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      });
      if (res.ok) {
        setActiveHash(hash);
      }
    } catch (e) {
      // silently ignore
    } finally {
      setRestoringHash(null);
    }
  };

  return (
    <>
      <div className={`buildover-sidebar ${isOpen ? '' : 'closed'}`}>
        <div className="buildover-sidebar-header">
          <span className="buildover-sidebar-title">변경 이력</span>
          <span className="buildover-sidebar-count">{commits.length}</span>
        </div>
        <div className="buildover-sidebar-list">
          {commits.length === 0 ? (
            <div className="buildover-sidebar-empty">
              <div className="buildover-sidebar-empty-icon">⏳</div>
              <div>아직 변경 이력이 없어요</div>
              <div className="buildover-sidebar-empty-sub">AI 요청이 완료되면 여기에 기록돼요</div>
            </div>
          ) : (
            commits.map((commit) => {
              const isRestoring = restoringHash === commit.hash;
              const isActive = activeHash === commit.hash;
              return (
                <div
                  key={commit.hash}
                  className={`buildover-commit-item ${isActive ? 'active' : ''} ${isRestoring ? 'restoring' : ''}`}
                  onClick={() => handleRestore(commit.hash)}
                  title="클릭하면 이 버전으로 복원됩니다"
                >
                  <div className="buildover-commit-msg">{commit.message}</div>
                  <div className="buildover-commit-meta">
                    <span className="buildover-commit-hash">{commit.shortHash}</span>
                    <span className="buildover-commit-time">{formatRelativeTime(commit.date)}</span>
                    {isRestoring && <span className="buildover-commit-restoring">복원 중…</span>}
                    {isActive && !isRestoring && <span className="buildover-commit-active-badge">복원됨</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <button
        className={`buildover-sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? '이력 닫기' : '변경 이력 열기'}
      >
        <span className="buildover-sidebar-toggle-icon">{isOpen ? '‹' : '›'}</span>
        {!isOpen && <span className="buildover-sidebar-toggle-label">이력</span>}
      </button>
    </>
  );
}
