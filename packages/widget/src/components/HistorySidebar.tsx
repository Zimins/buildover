import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { CommitEntry, ShareLinkInfo } from '../types';

interface HistorySidebarProps {
  commits: CommitEntry[];
  isOpen: boolean;
  onToggle: () => void;
  apiBase: string;
  isShareUser?: boolean;
}

type Tab = 'branches' | 'history';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

const STATUS_LABEL: Record<string, string> = {
  creating: '생성 중',
  ready: '실행 중',
  stopped: '중지됨',
  error: '오류',
};

const STATUS_CLASS: Record<string, string> = {
  creating: 'status-creating',
  ready: 'status-ready',
  stopped: 'status-stopped',
  error: 'status-error',
};

interface DiffResult {
  patch: string;
  files: Array<{ path: string; insertions: number; deletions: number }>;
  stats: { filesChanged: number; insertions: number; deletions: number };
}

// ── Diff viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ patch }: { patch: string }) {
  const lines = patch.split('\n');
  return (
    <pre className="buildover-diff-patch">
      {lines.map((line, i) => {
        const cls = line.startsWith('+') && !line.startsWith('+++')
          ? 'diff-add'
          : line.startsWith('-') && !line.startsWith('---')
          ? 'diff-del'
          : line.startsWith('@@')
          ? 'diff-hunk'
          : '';
        return <div key={i} className={cls}>{line || ' '}</div>;
      })}
    </pre>
  );
}

// ── Merge request panel ───────────────────────────────────────────────────────

function MergeRequestPanel({
  link,
  apiBase,
  onAction,
}: {
  link: ShareLinkInfo;
  apiBase: string;
  onAction: () => void;
}) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const [merging, setMerging] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (link.mergeStatus !== 'requested') return;
    setDiffLoading(true);
    fetch(`${apiBase}/buildover/api/share/${link.linkId}/diff`)
      .then(r => r.json())
      .then((data: DiffResult) => setDiff(data))
      .catch(() => {})
      .finally(() => setDiffLoading(false));
  }, [link.linkId, link.mergeStatus]);

  const handleMerge = async () => {
    setMerging(true);
    setResult(null);
    try {
      const res = await fetch(`${apiBase}/buildover/api/share/${link.linkId}/merge`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResult({ type: 'success', message: '머지 완료!' });
        onAction();
      } else {
        setResult({ type: 'error', message: data.message || '머지 실패' });
      }
    } catch {
      setResult({ type: 'error', message: '네트워크 오류' });
    } finally {
      setMerging(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await fetch(`${apiBase}/buildover/api/share/${link.linkId}/reject`, { method: 'POST' });
      onAction();
    } catch {
      // ignore
    } finally {
      setRejecting(false);
    }
  };

  if (link.mergeStatus === 'merged') {
    return <div className="buildover-merge-result success">✓ 머지 완료</div>;
  }
  if (link.mergeStatus === 'rejected') {
    return <div className="buildover-merge-result rejected">✗ 거절됨</div>;
  }

  return (
    <div className="buildover-merge-panel">
      {/* diff stats */}
      {diffLoading && <div className="buildover-merge-loading">diff 불러오는 중...</div>}
      {diff && (
        <>
          <div className="buildover-diff-stats">
            <span className="diff-stat-files">{diff.stats.filesChanged}개 파일</span>
            <span className="diff-stat-add">+{diff.stats.insertions}</span>
            <span className="diff-stat-del">−{diff.stats.deletions}</span>
          </div>

          {diff.files.length > 0 && (
            <div className="buildover-diff-files">
              {diff.files.map(f => (
                <div key={f.path} className="buildover-diff-file-row">
                  <span className="buildover-diff-file-path">{f.path}</span>
                  <span className="diff-stat-add">+{f.insertions}</span>
                  <span className="diff-stat-del">−{f.deletions}</span>
                </div>
              ))}
            </div>
          )}

          {diff.patch && (
            <button
              className="buildover-diff-toggle"
              onClick={() => setShowPatch(p => !p)}
            >
              {showPatch ? '▲ diff 숨기기' : '▼ diff 보기'}
            </button>
          )}
          {showPatch && diff.patch && <DiffViewer patch={diff.patch} />}
        </>
      )}

      {/* actions */}
      {result && (
        <div className={`buildover-merge-result ${result.type}`}>{result.message}</div>
      )}
      {!result && (
        <div className="buildover-merge-actions">
          {link.url && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="buildover-merge-btn preview"
            >
              미리보기
            </a>
          )}
          <button
            className="buildover-merge-btn merge"
            onClick={handleMerge}
            disabled={merging || rejecting}
          >
            {merging ? '머지 중...' : '머지'}
          </button>
          <button
            className="buildover-merge-btn reject"
            onClick={handleReject}
            disabled={merging || rejecting}
          >
            {rejecting ? '...' : '거절'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Branches tab ────────────────────────────────────────────────────────────

function BranchesTab({ apiBase }: { apiBase: string }) {
  const [links, setLinks] = useState<ShareLinkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/buildover/api/share/links`);
      if (res.ok) setLinks(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleCopy = (url: string, linkId: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(linkId);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const pendingCount = links.filter(l => l.mergeStatus === 'requested').length;

  if (loading) {
    return <div className="buildover-sidebar-empty"><div>불러오는 중...</div></div>;
  }

  if (links.length === 0) {
    return (
      <div className="buildover-sidebar-empty">
        <div className="buildover-sidebar-empty-icon">🔗</div>
        <div>발행된 링크가 없어요</div>
        <div className="buildover-sidebar-empty-sub">채팅창 하단의 🔗 링크 버튼으로 생성할 수 있어요</div>
      </div>
    );
  }

  return (
    <div className="buildover-sidebar-list">
      {pendingCount > 0 && (
        <div className="buildover-merge-notice">
          병합 요청 {pendingCount}건 대기 중
        </div>
      )}
      {links.map((link) => {
        const url = link.url || `${window.location.protocol}//${window.location.host}/s/${link.linkId}/`;
        const isExpanded = expanded === link.linkId;
        const isMergeRequested = link.mergeStatus === 'requested';
        return (
          <div
            key={link.linkId}
            className={`buildover-branch-item ${isExpanded ? 'expanded' : ''} ${isMergeRequested ? 'merge-requested' : ''}`}
          >
            <div
              className="buildover-branch-row"
              onClick={() => setExpanded(isExpanded ? null : link.linkId)}
            >
              <span className={`buildover-status-dot ${STATUS_CLASS[link.status] || ''}`} />
              <div className="buildover-branch-info">
                <span className="buildover-branch-name">
                  {link.description || link.linkId}
                </span>
                <span className="buildover-branch-meta">
                  {STATUS_LABEL[link.status]} · {formatRelativeTime(link.createdAt)}
                </span>
              </div>
              {isMergeRequested && (
                <span className="buildover-merge-badge">병합 요청</span>
              )}
              {link.mergeStatus === 'merged' && (
                <span className="buildover-merge-badge merged">머지됨</span>
              )}
              <span className="buildover-branch-chevron">{isExpanded ? '▾' : '▸'}</span>
            </div>

            {isExpanded && (
              <div className="buildover-branch-detail">
                {/* URL row */}
                <div className="buildover-branch-detail-row">
                  <span className="buildover-branch-detail-label">URL</span>
                  <div className="buildover-branch-url-row">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="buildover-branch-url"
                    >
                      :{new URL(url).port}/
                    </a>
                    <button
                      className="buildover-copy-btn"
                      onClick={(e) => { e.stopPropagation(); handleCopy(url, link.linkId); }}
                    >
                      {copied === link.linkId ? '✓' : '복사'}
                    </button>
                  </div>
                </div>
                <div className="buildover-branch-detail-row">
                  <span className="buildover-branch-detail-label">브랜치</span>
                  <code className="buildover-branch-code">{link.branchName}</code>
                </div>
                <div className="buildover-branch-detail-row">
                  <span className="buildover-branch-detail-label">베이스</span>
                  <code className="buildover-branch-code">{link.baseBranch}</code>
                </div>

                {/* merge request panel */}
                {(isMergeRequested || link.mergeStatus === 'merged' || link.mergeStatus === 'rejected') && (
                  <MergeRequestPanel
                    link={link}
                    apiBase={apiBase}
                    onAction={fetchLinks}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── History tab ─────────────────────────────────────────────────────────────

function HistoryTab({
  commits,
  apiBase,
}: {
  commits: CommitEntry[];
  apiBase: string;
}) {
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
      if (res.ok) setActiveHash(hash);
    } catch {
      // ignore
    } finally {
      setRestoringHash(null);
    }
  };

  if (commits.length === 0) {
    return (
      <div className="buildover-sidebar-empty">
        <div className="buildover-sidebar-empty-icon">⏳</div>
        <div>아직 변경 이력이 없어요</div>
        <div className="buildover-sidebar-empty-sub">AI 요청이 완료되면 여기에 기록돼요</div>
      </div>
    );
  }

  return (
    <div className="buildover-sidebar-list">
      {commits.map((commit) => {
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
      })}
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────────

export function HistorySidebar({ commits, isOpen, onToggle, apiBase, isShareUser }: HistorySidebarProps) {
  const [tab, setTab] = useState<Tab>(isShareUser ? 'history' : 'branches');

  const defaultTab: Tab = isShareUser ? 'history' : 'branches';

  useEffect(() => {
    if (isOpen) setTab(defaultTab);
  }, [isOpen]);

  return (
    <>
      <div className={`buildover-sidebar ${isOpen ? '' : 'closed'}`}>
        <div className="buildover-sidebar-tabs">
          {!isShareUser && (
            <button
              className={`buildover-sidebar-tab ${tab === 'branches' ? 'active' : ''}`}
              onClick={() => setTab('branches')}
            >
              브랜치
            </button>
          )}
          <button
            className={`buildover-sidebar-tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            변경이력
            {commits.length > 0 && (
              <span className="buildover-tab-count">{commits.length}</span>
            )}
          </button>
        </div>

        {tab === 'branches' && !isShareUser && <BranchesTab apiBase={apiBase} />}
        {tab === 'history' && <HistoryTab commits={commits} apiBase={apiBase} />}
      </div>

      <button
        className={`buildover-sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? '사이드바 닫기' : '사이드바 열기'}
      >
        <span className="buildover-sidebar-toggle-icon">{isOpen ? '‹' : '›'}</span>
        {!isOpen && <span className="buildover-sidebar-toggle-label">목록</span>}
      </button>
    </>
  );
}
