import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { FileChange } from '../types';

interface FileCardProps {
  file: FileChange;
}

export function FileCard({ file }: FileCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="buildover-file-card">
      <div
        className="buildover-file-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="buildover-file-info">
          <div className="buildover-file-path">{file.path}</div>
          <div className="buildover-file-stats">
            <span className="addition">+{file.additions}</span>
            {' / '}
            <span className="deletion">-{file.deletions}</span>
          </div>
        </div>
        <div className={`buildover-file-expand ${expanded ? 'expanded' : ''}`}>
          ▼
        </div>
      </div>
      {expanded && file.diff && (
        <div className="buildover-file-diff">
          <pre>{file.diff}</pre>
        </div>
      )}
    </div>
  );
}
